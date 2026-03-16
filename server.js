import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import axios from "axios";
import crypto from "crypto";

// (Opcional pero útil) Para que cualquier crash se vea en Logs de Render
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

const MAX_CUPOS = {
  clase: 22,
  junior: 22,
  senior: 22,
};

const normalizeCity = (city) => {
  const c = String(city || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (c === "santiago") return "santiago";
  if (c === "concon") return "concon";
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

async function getCuposFromSheets() {
  const appsScriptUrl = process.env.APPS_SCRIPT_URL;

  if (!appsScriptUrl) {
    throw new Error("Falta APPS_SCRIPT_URL en Render.");
  }

  const response = await axios.get(`${appsScriptUrl}?action=cupos`);
  return response.data;
}

function validateAvailability({ cupos, city, activity, category }) {
  const cityKey = normalizeCity(city);
  const activityKey = normalizeActivity(activity);
  const categoryKey = normalizeCategory(category);

  if (!cityKey) {
    return "Ciudad inválida.";
  }

  if (!activityKey) {
    return "Actividad inválida.";
  }

  if (!cupos || !cupos[cityKey]) {
    return "No se pudieron consultar los cupos.";
  }

  const ocupadosClase = Number(cupos[cityKey].clase || 0);
  const ocupadosJunior = Number(cupos[cityKey].junior || 0);
  const ocupadosSenior = Number(cupos[cityKey].senior || 0);

  if (activityKey === "clase") {
    if (ocupadosClase >= MAX_CUPOS.clase) {
      return "No quedan cupos para la clase magistral en esta ciudad.";
    }
  }

  if (activityKey === "audicion") {
    if (!categoryKey) {
      return "Falta la categoría de audición.";
    }

    if (categoryKey === "junior" && ocupadosJunior >= MAX_CUPOS.junior) {
      return "No quedan cupos para audición junior en esta ciudad.";
    }

    if (categoryKey === "senior" && ocupadosSenior >= MAX_CUPOS.senior) {
      return "No quedan cupos para audición senior en esta ciudad.";
    }
  }

  if (activityKey === "ambas") {
    if (ocupadosClase >= MAX_CUPOS.clase) {
      return "No quedan cupos para la clase magistral en esta ciudad.";
    }

    if (!categoryKey) {
      return "Falta la categoría de audición.";
    }

    if (categoryKey === "junior" && ocupadosJunior >= MAX_CUPOS.junior) {
      return "No quedan cupos para audición junior en esta ciudad.";
    }

    if (categoryKey === "senior" && ocupadosSenior >= MAX_CUPOS.senior) {
      return "No quedan cupos para audición senior en esta ciudad.";
    }
  }

  return null;
}

app.get("/cupos", async (_req, res) => {
  try {
    const cupos = await getCuposFromSheets();
    return res.json(cupos);
  } catch (error) {
    console.error("Error obteniendo cupos:", error.response?.data || error.message);
    return res.status(500).json({
      error: "No se pudieron obtener los cupos",
    });
  }
});

// Crear pago (Flow)
app.post("/create-payment", async (req, res) => {
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

  
    const apiKey = process.env.FLOW_API_KEY;
    const secretKey = process.env.FLOW_SECRET_KEY;
    const baseUrl = process.env.FLOW_BASE_URL;
    const appsScriptUrl = process.env.APPS_SCRIPT_URL;

    // Validaciones básicas
    if (!apiKey || !secretKey || !baseUrl) {
      return res.status(500).json({
        error:
          "Faltan variables de entorno (FLOW_API_KEY / FLOW_SECRET_KEY / FLOW_BASE_URL). Revisa Render > Environment.",
      });
    }

     if (!appsScriptUrl) {
      return res.status(500).json({ error: "Falta APPS_SCRIPT_URL en Render." });
    }

    if (!amount || !email) {
      return res.status(400).json({ error: "Faltan datos (amount, email)." });
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
       
    const commerceOrder = `BDM_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
     // ✅ Ciudad (viene desde el frontend como "santiago" o "concon")
const cityKey = String(city || "").toLowerCase();
const cityLabel =
  cityKey === "santiago" ? "Santiago" :
  cityKey === "concon" ? "Concón" :
  "Chile";

// ✅ Actividad (viene como "audicion" / "clase" / "ambas")
const activityKey = String(activity || "").toLowerCase();

// ✅ Fechas del EVENTO
const EVENT_DATES = {
  santiago: {
    audicion: "12 abril 2026",
    clase: "12 abril 2026",
    ambas: "12 abril 2026",
  },
  concon: {
    audicion: "11 abril 2026",
    clase: "11 abril 2026",
    ambas: "11 abril 2026",
  },
};

// Si no encuentra fecha, queda vacío
const eventDate = EVENT_DATES?.[cityKey]?.[activityKey] || "";

// ✅ Base del texto según actividad
let subjectBase = "Inscripción Bailarines del Mañana";
if (activityKey === "audicion") subjectBase = "Inscripción Audición - Bailarines del Mañana";
if (activityKey === "clase") subjectBase = "Clase Magistral Sebastián Vinet ";
if (activityKey === "ambas") subjectBase = "Audición + Clase Magistral - Bailarines del Mañana";

// ✅ Subject final que verá el cliente en Flow
const subject = eventDate
  ? `${subjectBase} | ${cityLabel} | ${eventDate}`
  : `${subjectBase} | ${cityLabel}`;
    const currency = "CLP";

    const urlConfirmation =
      "https://bailarines-del-manana-backend.onrender.com/confirm-payment";

    const urlReturn =
  "https://bailarines-del-manana-backend.onrender.com/return";
       
      // 1) Guardar PENDIENTE en Sheets
    await axios.post(appsScriptUrl, {
      action: "pendiente",
      orden: commerceOrder,
      nombre: nombre || "",
      email: String(email),
      ciudad: city || "",
      actividad: activity || "",
      categoria: category || "",
      monto: Number(amount),
      phone: phone || "",
      birthDate: birthDate || "",
      school: school || "",
      experience: experience || "",
    });
    
    // 2) Crear pago en Flow
    const params = {
      apiKey,
      commerceOrder,
      subject,
      currency,
      amount: Number(amount),
      email: String(email),
      urlConfirmation,
      urlReturn,
    };

    // ✅ Firma Flow: ordenar keys y concatenar key + value (sin =, sin &)
    const keys = Object.keys(params).sort();
    let toSign = "";
    for (const key of keys) {
      toSign += key + String(params[key]);
    }

    const signature = crypto
      .createHmac("sha256", secretKey)
      .update(toSign)
      .digest("hex");

    // ✅ Body x-www-form-urlencoded
    const body = new URLSearchParams({
      ...Object.fromEntries(
        Object.entries(params).map(([k, v]) => [k, String(v)])
      ),
      s: signature,
    }).toString();

    const response = await axios.post(`${baseUrl}/payment/create`, body, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  
     // 3) Guardar Token en Sheets (columna Token) usando la misma Orden
    const token = response.data?.token;
    if (token) {
      await axios.post(appsScriptUrl, {
        action: "set_token",
        orden: commerceOrder,
        token: String(token),
      });
    }

    // Flow responde { url, token, flowOrder, ... }
    return res.json(response.data);
  } catch (error) {
    const details = error.response?.data || error.message;
    console.error("FLOW ERROR:", details);
    return res.status(500).json({ error: "Error creando pago", details });
  }
});

// Webhook de confirmación (Flow llamará aquí)
app.post("/confirm-payment", async (req, res) => {
  try {
    const apiKey = process.env.FLOW_API_KEY;
    const secretKey = process.env.FLOW_SECRET_KEY;
    const baseUrl = process.env.FLOW_BASE_URL;
    const appsScriptUrl = process.env.APPS_SCRIPT_URL;

    const token = req.body?.token || req.query?.token;
    if (!apiKey || !secretKey || !baseUrl || !appsScriptUrl) return res.status(200).send("OK");
    if (!token) return res.status(200).send("OK");

    // Consultar estado real en Flow
    const statusParams = { apiKey, token: String(token) };
    const keys = Object.keys(statusParams).sort();
    let toSign = "";
    for (const k of keys) toSign += k + String(statusParams[k]);

    const s = crypto
      .createHmac("sha256", secretKey)
      .update(toSign)
      .digest("hex");

    const qs = new URLSearchParams({ ...statusParams, s }).toString();
    const flowStatus = await axios.get(`${baseUrl}/payment/getStatus?${qs}`);

    const data = flowStatus.data;
    const commerceOrder = data?.commerceOrder;
    const status = Number(data?.status); // 2 = pagado

    if (commerceOrder && status === 2) {
      await axios.post(appsScriptUrl, {
        action: "pagar",
        orden: String(commerceOrder),
      });
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("confirm error:", err.response?.data || err.message);
    return res.status(200).send("OK");
  }
});

app.all("/return", (req, res) => {
  return res.redirect(
    "https://bailarines-del-manana.onrender.com/pago-exitoso"
  );
});

// ✅ Importante para Render: bind al puerto asignado
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});