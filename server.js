import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import axios from "axios";

process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => {
  res.send("Backend Audiciones funcionando correctamente 🚀");
});

// ======================
// CUPOS CONFIG
// ======================

const MAX_CUPOS = {
  clase: 30,
  junior: 30,
  senior: 30,
};

// ======================
// NORMALIZADORES
// ======================

const normalizeCity = (city) => {
  const c = String(city || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (c === "lima") return "lima";
  if (c === "trujillo") return "trujillo";
  return "";
};

const normalizeActivity = (activity) => {
  const a = String(activity || "").toLowerCase().trim();
  if (a === "clase") return "clase";
  if (a === "audicion") return "audicion";
  if (a === "ambas") return "ambas";
  return "";
};

const normalizeCategory = (category) => {
  const c = String(category || "").toLowerCase().trim();
  if (c === "junior") return "junior";
  if (c === "senior") return "senior";
  return "";
};

// ======================
// CUPOS DESDE SHEETS
// ======================

async function getCuposFromSheets() {
  const appsScriptUrl = process.env.APPS_SCRIPT_URL;

  if (!appsScriptUrl) {
    throw new Error("Falta APPS_SCRIPT_URL en Render.");
  }

  const response = await axios.get(`${appsScriptUrl}?action=cupos`);
  return response.data;
}

// ======================
// VALIDACIÓN CUPOS
// ======================

function validateAvailability({ cupos, city, activity, category }) {
  const cityKey = normalizeCity(city);
  const activityKey = normalizeActivity(activity);
  const categoryKey = normalizeCategory(category);

  if (!cityKey) return "Ciudad inválida.";
  if (!activityKey) return "Actividad inválida.";
  if (!cupos || !cupos[cityKey]) return "No se pudieron consultar los cupos.";

  const ocupadosClase = Number(cupos[cityKey].clase || 0);
  const ocupadosJunior = Number(cupos[cityKey].junior || 0);
  const ocupadosSenior = Number(cupos[cityKey].senior || 0);

  if (activityKey === "clase") {
    if (ocupadosClase >= MAX_CUPOS.clase) {
      return "No quedan cupos para la clase magistral.";
    }
  }

  if (activityKey === "audicion") {
    if (!categoryKey) return "Falta categoría.";

    if (categoryKey === "junior" && ocupadosJunior >= MAX_CUPOS.junior) {
      return "No quedan cupos junior.";
    }

    if (categoryKey === "senior" && ocupadosSenior >= MAX_CUPOS.senior) {
      return "No quedan cupos senior.";
    }
  }

  if (activityKey === "ambas") {
    if (ocupadosClase >= MAX_CUPOS.clase) {
      return "No quedan cupos clase.";
    }

    if (!categoryKey) return "Falta categoría.";

    if (categoryKey === "junior" && ocupadosJunior >= MAX_CUPOS.junior) {
      return "No quedan cupos junior.";
    }

    if (categoryKey === "senior" && ocupadosSenior >= MAX_CUPOS.senior) {
      return "No quedan cupos senior.";
    }
  }

  return null;
}

// ======================
// CUPOS ENDPOINT
// ======================

app.get("/cupos", async (_req, res) => {
  try {
    const cupos = await getCuposFromSheets();
    return res.json(cupos);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "No se pudieron obtener los cupos",
    });
  }
});

// ======================
// REGISTRO PERÚ (TRANSFERENCIA)
// ======================

app.post("/register", async (req, res) => {
  try {
    const {
      amount,
      email,
      nombre,
      phone,
      city,
      activity,
      category,
      birthDate = "",
      school = "",
      experience = "",
    } = req.body;

    const appsScriptUrl = process.env.APPS_SCRIPT_URL;

    if (!appsScriptUrl) {
      return res.status(500).json({
        error: "Falta APPS_SCRIPT_URL",
      });
    }

    if (!amount || !email) {
      return res.status(400).json({
        error: "Faltan datos obligatorios",
      });
    }

    const cupos = await getCuposFromSheets();

    const availabilityError = validateAvailability({
      cupos,
      city,
      activity,
      category,
    });

    if (availabilityError) {
      return res.status(409).json({ error: availabilityError });
    }

    const orden = `BDM_${Date.now()}_${Math.random()
      .toString(16)
      .slice(2, 8)}`;

    await axios.post(appsScriptUrl, {
      action: "pendiente",
      orden,
      nombre: nombre || "",
      email: String(email),
      ciudad: city || "",
      actividad: activity || "",
      categoria: category || "",
      monto: Number(amount),
      phone: phone || "",
      birthDate,
      school,
      experience,
    });

    return res.json({
      success: true,
      orden,
      paymentMethod: "TRANSFERENCIA",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error registrando inscripción",
    });
  }
});

// ======================
// FLOW DESHABILITADO (RESERVADO CHILE)
// ======================

app.post("/create-payment", async (_req, res) => {
  return res.json({
    success: true,
    message:
      "Flow deshabilitado. Método activo: transferencia bancaria (Perú).",
  });
});

app.post("/confirm-payment", async (_req, res) => {
  return res.status(200).send("OK");
});

app.all("/return", (req, res) => {
  return res.redirect(
    "https://bailarines-del-manana.onrender.com/pago-exitoso"
  );
});

// ======================
// START SERVER
// ======================

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});