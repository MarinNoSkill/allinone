import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { toast, Toaster } from "react-hot-toast";
import GalaxyBackground from "./GalaxyBackground";
import ButtonToolTip from "./ButtonToolTip";
import { useTheme } from "../pages/ThemeContext";
import { User, TrendingUp, Scale, Ruler, Activity } from "lucide-react";

const activityMultipliers = {
  basal: 1.2,
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryActive: 1.9,
  extraActive: 2.2,
};

const goalAdjustments = {
  maintain: 1.0,
  mildLoss: 0.91,
  loss: 0.81,
  extremeLoss: 0.62,
  mildGain: 1.09,
  gain: 1.19,
  fastGain: 1.38,
};

const goalLabels: { [key: string]: string } = {
  maintain: "Mantener peso",
  mildLoss: "Pérdida leve (0.25 kg/sem)",
  loss: "Pérdida (0.5 kg/sem)",
  extremeLoss: "Pérdida extrema (1 kg/sem)",
  mildGain: "Aumento leve (0.25 kg/sem)",
  gain: "Aumento (0.5 kg/sem)",
  fastGain: "Aumento rápido (1 kg/sem)",
};

const GoalCard: React.FC<{
  goal: string;
  calorieValue: number;
  isSelected: boolean;
  onClick: () => void;
  baseCalories: number;
}> = ({ goal, calorieValue, isSelected, onClick, baseCalories }) => {
  const { isDarkMode } = useTheme();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className={`p-4 rounded-lg cursor-pointer transition-all duration-300 ${
        isDarkMode
          ? `bg-[#2D3242] ${
              isSelected
                ? "border-2 border-[#ff9404]"
                : "border border-gray-600"
            } hover:bg-[#282c3c]`
          : `bg-white ${
              isSelected
                ? "border-2 border-[#ff9404]"
                : "border border-gray-300"
            } hover:bg-gray-50`
      }`}
      onClick={onClick}
    >
      <p className="font-medium text-[#ff9404]">{goalLabels[goal]}</p>
      <p
        className={`text-lg ${isDarkMode ? "text-gray-200" : "text-gray-900"}`}
      >
        {calorieValue} kcal/day (
        {Math.round((calorieValue / baseCalories) * 100)}
        %)
      </p>
    </motion.div>
  );
};

const CalorieCalculator: React.FC = () => {
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();
  const [age, setAge] = useState<number | undefined>(18);
  const [gender, setGender] = useState<"male" | "female">("male");
  const [height, setHeight] = useState<number | undefined>(180);
  const [weight, setWeight] = useState<number | undefined>(80);
  const [activityLevel, setActivityLevel] = useState<string>("moderate");
  const [calories, setCalories] = useState<{ [key: string]: number } | null>(
    null
  );
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        setError("Debes iniciar sesión para usar la calculadora.");
        navigate("/login");
      } else {
        setUserEmail(user.email || "");
      }
    };
    checkAuth();
  }, [navigate]);

  const handleInputChange = useCallback(
    (
      e: React.ChangeEvent<HTMLInputElement>,
      setter: React.Dispatch<React.SetStateAction<number | undefined>>,
      minValue?: number
    ) => {
      const value = e.target.value ? Number(e.target.value) : undefined;
      if (value !== undefined && (minValue === undefined || value > minValue)) {
        setter(value);
      } else {
        setter(undefined);
      }
    },
    []
  );

  const calculateCalories = useCallback(() => {
    if (
      age === undefined ||
      height === undefined ||
      weight === undefined ||
      age < 15 ||
      age > 80 ||
      height <= 0 ||
      weight <= 0
    ) {
      setCalories(null);
      toast.error("Por favor ingrese valores válidos en todos los campos.");
      return;
    }

    setIsLoading(true);
    let bmr: number;
    if (gender === "male") {
      bmr = 10 * weight + 6.25 * height - 5 * age + 5;
    } else {
      bmr = 10 * weight + 6.25 * height - 5 * age - 161;
    }

    const activityFactor =
      activityMultipliers[activityLevel as keyof typeof activityMultipliers];
    const baseTDEE = Math.round(bmr * activityFactor);

    const goalCalories: { [key: string]: number } = {};
    for (const [goal, adjustment] of Object.entries(goalAdjustments)) {
      goalCalories[goal] = Math.round(baseTDEE * adjustment);
    }

    setCalories(goalCalories);
    setIsLoading(false);
    toast.success("Calorías calculadas correctamente.");
  }, [age, height, weight, gender, activityLevel]);

  const handleGoalSelect = useCallback(
    async (goal: string, calorieValue: number) => {
      if (!userEmail) {
        setError("Debes estar autenticado para seleccionar un objetivo.");
        toast.error("Autenticación requerida.");
        return;
      }

      setSelectedGoal(goal);

      try {
        const response = await axios.post(
          `${import.meta.env.VITE_BACKEND_URL}/api/set-calorie-goal`,
          {
            email: userEmail,
            calorieGoal: calorieValue,
          }
        );

        if (response.data.success) {
          toast.success("Calorie goal set successfully!");
          navigate("/dashboard");
        } else {
          setError(
            response.data.error || "Error al establecer el límite de calorías."
          );
          toast.error(response.data.error || "Error setting calorie goal.");
        }
      } catch (err) {
        console.log(err);
        setError("Error al conectar con el servidor. Intenta de nuevo.");
        toast.error("Server error. Please try again.");
      }
    },
    [userEmail, navigate]
  );

  const isButtonDisabled =
    age === undefined ||
    height === undefined ||
    weight === undefined ||
    age < 15 ||
    age > 80 ||
    height <= 0 ||
    weight <= 0;

  const infoText = {
    calorieCalculatorInfo:
      "Calcula tus necesidades calóricas diarias basadas en tu edad, género, altura, peso y nivel de actividad. Selecciona un objetivo para establecer tu meta diaria de calorías.",
  };

  const formProgress = () => {
    const fields = [age, height, weight, gender, activityLevel];
    const filledFields = fields.filter((field) => field !== undefined && field !== "").length;
    return (filledFields / fields.length) * 100;
  };

  return (
    <div
      className={`min-h-screen flex items-center justify-center p-6 relative w-full transition-colors duration-300 ${
        isDarkMode ? "bg-[#282c3c]" : "bg-white-100"
      }`}
    >
      <GalaxyBackground />
      <Toaster position="top-center" reverseOrder={false} />
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={`max-w-2xl w-full rounded-xl shadow-md p-8 relative z-10 ${
          isDarkMode ? "bg-[#3B4252]" : "bg-white"
        }`}
      >
        <div className="flex items-center justify-center gap-3 mb-8">
          <h2
            className={`text-4xl font-bold ${
              isDarkMode ? "text-white" : "text-gray-900"
            }`}
          >
            Calculadora de Calorías
          </h2>
          <ButtonToolTip content={infoText.calorieCalculatorInfo} />
        </div>

        <motion.div
          className="mb-6"
          initial={{ width: 0 }}
          animate={{ width: "100%" }}
          transition={{ duration: 0.8 }}
        >
          <div className="flex justify-between mb-2">
            <span
              className={`text-sm font-medium ${
                isDarkMode ? "text-gray-400" : "text-gray-600"
              }`}
            >
              Progreso del formulario
            </span>
            <span
              className={`text-sm font-semibold ${
                isDarkMode ? "text-[#ff9404]" : "text-[#ff9404]"
              }`}
            >
              {Math.round(formProgress())}%
            </span>
          </div>
          <div
            className={`h-2 rounded-full ${
              isDarkMode ? "bg-gray-600" : "bg-gray-300"
            }`}
          >
            <motion.div
              className="h-full bg-[#ff9404] rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${formProgress()}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </motion.div>

        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`mb-4 text-center text-sm ${
              isDarkMode ? "text-red-400" : "text-red-600"
            }`}
          >
            {error}
          </motion.p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            calculateCalories();
          }}
          className="space-y-6"
        >
          <div>
            <label
              className={`flex items-center gap-2 text-sm font-medium ${
                isDarkMode ? "text-gray-400" : "text-gray-600"
              } mb-1`}
            >
              <User className="w-4 h-4 text-[#ff9404]" />
              Edad (15-80)
            </label>
            <input
              type="number"
              id="age"
              value={age ?? ""}
              onChange={(e) => handleInputChange(e, setAge)}
              className={`w-full px-2.5 py-1.5 text-sm border rounded-md text-center focus:outline-none focus:border-[#ff9404] focus:ring-2 focus:ring-[#ff9404]/20 focus:scale-102 transition-all duration-300 placeholder:text-gray-500 [.error&]:border-[#ff4444] [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none sm:text-sm sm:px-2.5 sm:py-1.5 ${
                isDarkMode
                  ? "bg-[#2D3242] text-gray-200 border-gray-500 focus:bg-[#2D3242]"
                  : "bg-white text-gray-900 border-gray-300 focus:bg-[#F8F9FA]"
              }`}
              placeholder="Enter your age"
            />
          </div>

          <div>
            <label
              className={`flex items-center gap-2 text-sm font-medium ${
                isDarkMode ? "text-gray-400" : "text-gray-600"
              } mb-1`}
            >
              <TrendingUp className="w-4 h-4 text-[#ff9404]" />
              Género
            </label>
            <div className="flex space-x-6">
              <label
                className={`flex items-center ${
                  isDarkMode ? "text-gray-200" : "text-gray-900"
                }`}
              >
                <input
                  type="radio"
                  value="male"
                  checked={gender === "male"}
                  onChange={() => setGender("male")}
                  className={`w-5 h-5 border-2 rounded-full bg-transparent checked:bg-white checked:after:content-[''] checked:after:block checked:after:w-3 checked:after:h-3 checked:after:bg-[#ff9404] checked:after:rounded-full checked:after:absolute checked:after:top-1/2 checked:after:left-1/2 checked:after:-translate-x-1/2 checked:after:-translate-y-1/2 relative transition-all duration-300 hover:border-[#ff9404] hover:shadow-[0_0_8px_rgba(255,148,4,0.5)] mr-2 appearance-none ${
                    isDarkMode ? "border-black" : "border-gray-500"
                  }`}
                />
                Masculino
              </label>
              <label
                className={`flex items-center ${
                  isDarkMode ? "text-gray-200" : "text-gray-900"
                }`}
              >
                <input
                  type="radio"
                  value="female"
                  checked={gender === "female"}
                  onChange={() => setGender("female")}
                  className={`w-5 h-5 border-2 rounded-full bg-transparent checked:bg-white checked:after:content-[''] checked:after:block checked:after:w-3 checked:after:h-3 checked:after:bg-[#ff9404] checked:after:rounded-full checked:after:absolute checked:after:top-1/2 checked:after:left-1/2 checked:after:-translate-x-1/2 checked:after:-translate-y-1/2 relative transition-all duration-300 hover:border-[#ff9404] hover:shadow-[0_0_8px_rgba(255,148,4,0.5)] mr-2 appearance-none ${
                    isDarkMode ? "border-black" : "border-gray-500"
                  }`}
                />
                Femenino
              </label>
            </div>
          </div>

          <div>
            <label
              className={`flex items-center gap-2 text-sm font-medium ${
                isDarkMode ? "text-gray-400" : "text-gray-600"
              } mb-1`}
            >
              <Ruler className="w-4 h-4 text-[#ff9404]" />
              Altura (cm)
            </label>
            <input
              type="number"
              id="height"
              value={height ?? ""}
              onChange={(e) => handleInputChange(e, setHeight, 0)}
              className={`w-full px-2.5 py-1.5 text-sm border rounded-md text-center focus:outline-none focus:border-[#ff9404] focus:ring-2 focus:ring-[#ff9404]/20 focus:scale-102 transition-all duration-300 placeholder:text-gray-500 [.error&]:border-[#ff4444] [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none sm:text-sm sm:px-2.5 sm:py-1.5 ${
                isDarkMode
                  ? "bg-[#2D3242] text-gray-200 border-gray-500 focus:bg-[#2D3242]"
                  : "bg-white text-gray-900 border-gray-300 focus:bg-[#F8F9FA]"
              }`}
              placeholder="Enter your height"
            />
          </div>

          <div>
            <label
              className={`flex items-center gap-2 text-sm font-medium ${
                isDarkMode ? "text-gray-400" : "text-gray-600"
              } mb-1`}
            >
              <Scale className="w-4 h-4 text-[#ff9404]" />
              Peso (kg)
            </label>
            <input
              type="number"
              id="weight"
              value={weight ?? ""}
              onChange={(e) => handleInputChange(e, setWeight, 0)}
              className={`w-full px-2.5 py-1.5 text-sm border rounded-md text-center focus:outline-none focus:border-[#ff9404] focus:ring-2 focus:ring-[#ff9404]/20 focus:scale-102 transition-all duration-300 placeholder:text-gray-500 [.error&]:border-[#ff4444] [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none sm:text-sm sm:px-2.5 sm:py-1.5 ${
                isDarkMode
                  ? "bg-[#2D3242] text-gray-200 border-gray-500 focus:bg-[#2D3242]"
                  : "bg-white text-gray-900 border-gray-300 focus:bg-[#F8F9FA]"
              }`}
              placeholder="Enter your weight"
            />
          </div>

          <div>
            <label
              className={`flex items-center gap-2 text-sm font-medium ${
                isDarkMode ? "text-gray-400" : "text-gray-600"
              } mb-1`}
            >
              <Activity className="w-4 h-4 text-[#ff9404]" />
              Nivel de Actividad
            </label>
            <select
              id="activity"
              value={activityLevel}
              onChange={(e) => setActivityLevel(e.target.value)}
              className={`w-full px-2.5 py-1.5 text-sm border rounded-md focus:outline-none focus:border-[#ff9404] focus:ring-2 focus:ring-[#ff9404]/20 focus:scale-102 transition-all duration-300 appearance-none bg-no-repeat bg-[right_0.75rem_center] bg-[length:1.5em_1.5em] sm:text-sm sm:px-2.5 sm:py-1.5 sm:pr-7 pr-6 ${
                isDarkMode
                  ? "bg-[#2D3242] text-gray-200 border-gray-500 focus:bg-[#2D3242] bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%22%23ffffff%22%20stroke-width%3D%222%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20d%3D%22M19%209l-7%207-7-7%22%2F%3E%3C%2Fsvg%3E')]"
                  : "bg-white text-gray-900 border-gray-300 focus:bg-white bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%22%236B7280%22%20stroke-width%3D%222%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20d%3D%22M19%209l-7%207-7-7%22%2F%3E%3C%2Fsvg%3E')]"
              }`}
            >
              <option value="basal">Tasa Metabólica Basal (BMR)</option>
              <option value="sedentary">
                Sedentario: sin ejercicio o actividad física ligera
              </option>
              <option value="light">Ligero: ejercicio 1-2 veces/semana</option>
              <option value="moderate">
                Moderado: ejercicio 2-4 veces/semana
              </option>
              <option value="active">Activo: ejercicio 4-5 veces/semana</option>
              <option value="veryActive">
                Muy Activo: ejercicio intenso diario o trabajo físico
              </option>
              <option value="extraActive">
                Extra Activo: ejercicio intenso 2 veces al día
              </option>
            </select>
          </div>

          <button
            type="submit"
            className={`w-full py-3 px-4 text-sm font-semibold rounded-md border border-[#ff9404] shadow-[0_0_10px_rgba(255,148,4,0.3)] hover:shadow-[0_0_15px_rgba(255,148,4,0.5)] hover:scale-105 active:scale-95 transition-all duration-300 ${
              isDarkMode
                ? "bg-gradient-to-br from-[#2D3242] to-[#3B4252] text-gray-200 hover:from-[#3B4252] hover:to-[#4B5563]"
                : "bg-gray-200 text-gray-900 hover:bg-gray-300"
            }`}
            disabled={isButtonDisabled || isLoading}
          >
            {isLoading ? (
              <svg
                className="animate-spin h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
            ) : (
              "Estimar mis Calorías"
            )}
          </button>
        </form>

        <AnimatePresence>
          {calories && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.5 }}
              className="mt-8"
            >
              <h2
                className={`mt-12 text-3xl font-bold text-center ${
                  isDarkMode ? "text-white" : "text-gray-900"
                } mb-6`}
              >
                Calorías Diarias Estimadas
              </h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <h3
                    className={`text-lg font-semibold mb-4 text-center ${
                      isDarkMode ? "text-white" : "text-gray-900"
                    }`}
                  >
                    Pérdida de Peso Estimada
                  </h3>
                  <div className="space-y-4">
                    {["maintain", "mildLoss", "loss", "extremeLoss"].map(
                      (goal) => (
                        <GoalCard
                          key={goal}
                          goal={goal}
                          calorieValue={calories[goal]}
                          isSelected={selectedGoal === goal}
                          onClick={() => handleGoalSelect(goal, calories[goal])}
                          baseCalories={calories.maintain}
                        />
                      )
                    )}
                  </div>
                </div>
                <div>
                  <h3
                    className={`text-lg font-semibold mb-4 text-center ${
                      isDarkMode ? "text-white" : "text-gray-900"
                    }`}
                  >
                    Ganancia de Peso Estimada
                  </h3>
                  <div className="space-y-4">
                    {["mildGain", "gain", "fastGain"].map((goal) => (
                      <GoalCard
                        key={goal}
                        goal={goal}
                        calorieValue={calories[goal]}
                        isSelected={selectedGoal === goal}
                        onClick={() => handleGoalSelect(goal, calories[goal])}
                        baseCalories={calories.maintain}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default React.memo(CalorieCalculator);