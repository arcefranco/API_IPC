import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import axios from "axios";
import path, { dirname } from "path";
import dotenv from "dotenv";
import { Sequelize, DataTypes, QueryTypes } from "sequelize";
import cron from "cron";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));
const apiGob =
  "https://apis.datos.gob.ar/series/api/series/?ids=148.3_INIVELNAL_DICI_M_26&limit=5000&format=json";
const PORT = 3000;

const sequelize = new Sequelize(
  "pa7_comun",
  process.env.DB_USERNAME,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: "mysql",
    dialectOptions: {
      multipleStatements: true,
    },
  }
);
const Datos = sequelize.define(
  "IPC",
  {
    fecha: {
      type: DataTypes.STRING(150),
      primaryKey: true, // Indicar que 'fecha' es la clave primaria
      allowNull: false,
    },
    indice: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
  },
  {
    timestamps: false, // Deshabilitar campos createdAt y updatedAt
  }
);

app.listen(PORT, (error) => {
  if (!error) console.log("Escuchando en puerto: " + PORT);
  else console.log("Ocurrió un error: ", error);
});

app.get("/", (req, res) => {
  return res.send("API IPC");
});

app.get("/ipc", async (req, res) => {
  const { data } = await axios.get(apiGob);
  console.log(data);
  return res.send(data["data"]);
});

/* app.get("/fecha", async (req, res) => {
  try {
    buscarIPC();
    return res.send("OK");
  } catch (error) {
    return res.send("error: ", error);
  }
}); */

const buscarIPC = async () => {
  //obtengo el mes de la ultima fecha ingresada en la DB
  let mesUltimo;
  try {
    const consultaMes = await sequelize.query(
      "SELECT MONTH(MAX(fecha)) as fecha from IPCs",
      {
        type: Sequelize.QueryTypes.SELECT,
      }
    );

    // Acceder al valor del último mes
    mesUltimo = consultaMes[0].fecha;
    console.log("ultimo mes: ", mesUltimo);
  } catch (error) {
    console.error("Error al obtener la última fecha", error);
  }
  //obtengo el mes actual
  const fechaActual = new Date();
  const mesActual = fechaActual.getMonth() + 1;
  console.log("actual mes: ", mesActual);
  console.log("diferencia: ", mesActual - mesUltimo);
  if (mesActual - mesUltimo === 1) {
    return;
  } else {
    let response;
    let ultimoIPC;
    try {
      response = await axios.get(apiGob);
      ultimoIPC = response.data["data"][response.data["data"].length - 1];
    } catch (error) {
      throw error;
    }
    //insertarlo SOLO si la fecha es distinta a la del ultimo indice insertado
    let ultimaFechaAPI = new Date(ultimoIPC[0]);
    if (
      ultimaFechaAPI
        .toLocaleString("es-ES", { timeZone: "UTC" })
        .split("/")[1] !== mesUltimo
    ) {
      try {
        await sequelize.query("INSERT INTO IPCs (fecha, indice) VALUES (?,?)", {
          replacements: [ultimoIPC[0], ultimoIPC[1]],
          type: QueryTypes.INSERT,
        });
      } catch (error) {
        throw error;
      }
    } else {
      return;
    }
  }
};

let task = cron.CronJob("0 9 * * *", async function () {
  try {
    await buscarIPC();
  } catch (error) {
    console.log(error);
  }
  console.log("Ejecutando tarea diaria a las 9 AM");
});

task.start();