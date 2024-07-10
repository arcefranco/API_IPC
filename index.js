import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import axios from "axios";
import path, { dirname } from "path";
import dotenv from "dotenv";
import { Sequelize, DataTypes, QueryTypes } from "sequelize";
import cron from "cron";
import fetch from "node-fetch";
import { emailUpdateIPC, sendEmail } from "./helpers/sendEmail.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));
const apiGob =
  "http://apis.datos.gob.ar/series/api/series/?ids=148.3_INIVELNAL_DICI_M_26&limit=5000&format=json";
const PORT = process.env.PORT;

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

async function probarConexion() {
  try {
    // Intenta autenticarte en la base de datos
    await sequelize.authenticate();
    console.log("Conexión a la base de datos exitosa");
  } catch (error) {
    console.error("Error al conectar a la base de datos:", error.message);
  }
}

// Llama a la función para probar la conexión al inicio
probarConexion();

app.listen(PORT, (error) => {
  if (!error) console.log("Escuchando en puerto: " + PORT);
  else console.log("Ocurrió un error: ", error);
});

app.get("/", (req, res) => {
  return res.send("API IPC");
});

app.get("/ipc", async (req, res) => {
  try {
    await fetch(apiGob)
      .then((response) => response.json())
      .then((data) => {
        return res.send(data);
      })
      .catch((error) => {
        return res.send(error);
      });
  } catch (error) {
    console.log(error);
    return res.send(error);
  }
});

app.post("/email", async (req, res) => {
  const { email } = req.body;
  try {
    await sendEmail(email);
    return res.send("Email enviado correctamente");
  } catch (error) {
    return res.send("Error al enviar email: ", error);
  }
});
app.get("/fecha", async (req, res) => {
  try {
    buscarIPC();
    return res.send("OK");
  } catch (error) {
    return res.send("error: ", error);
  }
});

const buscarIPC = async () => {
  //obtengo el mes de la ultima fecha ingresada en la DB
  let mesUltimo;
  let anioUltimo;
  try {
    const consulta = await sequelize.query(
      "SELECT MAX(fecha) as fecha from IPCs",
      {
        type: Sequelize.QueryTypes.SELECT,
      }
    );

    // Acceder al valor del último mes
    let fechaDB = consulta[0].fecha;
    mesUltimo = fechaDB.split("-")[1];
    anioUltimo = fechaDB.split("-")[0];
  } catch (error) {
    console.error("Error al obtener la última fecha", error);
  }
  //obtengo el mes y año actual y la diferencia entre los meses segun ambos parámetros
  const fechaActual = new Date();
  const mesActual = fechaActual.getMonth() + 1;
  const anioActual = fechaActual.getFullYear();
  const diferenciaMeses =
    mesActual - mesUltimo + 12 * (anioActual - anioUltimo);
  console.log("mesUltimo: ", mesUltimo);
  console.log("mesActual: ", mesActual);
  console.log("anioUltimo: ", anioUltimo);
  console.log("anioActual: ", anioActual);
  console.log("diferencia entre meses: ", diferenciaMeses);
  if (diferenciaMeses === 1) {
    return;
  } else {
    //si la diferencia es 2 o más hay que buscar en la apiGob
    let response;
    let ultimoIPC;
    try {
      let json = await fetch(apiGob);
      response = await json.json();
      ultimoIPC = response["data"][response["data"].length - 1]; //va a buscar a al apigob el ultimo indice
    } catch (error) {
      throw error;
    }
    //inserta SOLO si la fecha es distinta a la del ultimo indice insertado
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
        await emailUpdateIPC("farce@giama.com.ar");
      } catch (error) {
        throw error;
      }
    } else {
      //en caso de que la diferencia sea mas de uno pero el ultimo indice insertado es igual al ultimo indice en la apiGob
      //y hayan pasado 10 días, se envia el mail
      if (fechaActual.getDate() >= 10) {
        try {
          await sendEmail("farce@giama.com.ar");
          console.log("Email enviado correctamente");
        } catch (error) {
          console.log("Error al enviar email: ", error);
        }
      } else {
        return;
      }
    }
  }
  return;
};

let task = new cron.CronJob("10 10 * * *", async function () {
  try {
    console.log(process.env.ELASTIC_USER, process.env.ELASTIC_PASS);
    await buscarIPC();
  } catch (error) {
    console.log(error);
  }
});

task.start();
