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
import { getFirstDayPreviousMonth, getFirstDayNextMonth } from "./helpers/getFirstDayPreviousMonth.js";
import { getDaysInMonth } from "./helpers/getDaysInMonth.js";
import { getFirstDayCurrentMonth } from "./helpers/getFirstDayCurrentMonth.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));
const apiGob =
  "https://apis.datos.gob.ar/series/api/series/?ids=145.3_INGNACNAL_DICI_M_15&format=json&limit=500";
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




const buscarIPC2 = async () => {
  const hayNuevoPorcentaje = await nuevoPorcentaje()
  if(hayNuevoPorcentaje){
    console.log(hayNuevoPorcentaje)
    //busco ultimo porcentaje IPC
    let ultimo_porcentaje_ipc
    const mes_anterior = getFirstDayPreviousMonth()
    const mes_siguiente = getFirstDayNextMonth()
    const mes_actual = getFirstDayCurrentMonth()
    try {
      const result = await axios.get("https://api.argly.com.ar/v1/ipc")
      console.log("ultimo porcentaje: ", result.data["data"]["indice_ipc"])
      ultimo_porcentaje_ipc = (result.data["data"]["indice_ipc"] / 100) + 1
    } catch (error) {
      console.log(error)
      return error
    }
     //busco el ultimo indice real
    let ultimo_indice_real /** en abril, es el de marzo */
    try {
      const result = await sequelize.query("SELECT indice FROM IPCs ORDER BY fecha DESC LIMIT 1", {
        type: QueryTypes.SELECT
      })
      ultimo_indice_real = Math.round(result[0]["indice"] * 10000) / 10000
    } catch (error) {
      console.log(error)
      return error
    } 
    const indice_real_actual = Math.round(ultimo_indice_real * ultimo_porcentaje_ipc * 10000) / 10000
    /**actual: sería el que obtengo en mayo porque ya tengo el porcentaje de abril. el indice es el de abril */
  
    //inserto nuevo IPC real
     try {
      await sequelize.query("INSERT INTO IPCs (fecha, indice, estimado_real) VALUES (?,?,?)",{
        type: QueryTypes.INSERT,
        replacements: [mes_anterior, indice_real_actual, "R"]
      })
    } catch (error) {
      console.log(error)
      return error
    } /**inserto en ipc mensual el de abril real (que obtuve en mayo) */
  
    //el procedimiento trabaja sobre los estimados del mes actual y los actualiza (pasan a ser reales)
    let numero_mes_anterior = mes_anterior.split("-")[1] /** actualizo los de abril estando en mayo, mes anterior es abril */
    let numero_año_mes_anterior = mes_anterior.split("-")[0]
    let cantidad_dias_mes_anterior = getDaysInMonth(numero_mes_anterior, numero_año_mes_anterior);
    const factor_diario = Math.pow(
    indice_real_actual /**abril */ / ultimo_indice_real /**marzo */,
    1 / cantidad_dias_mes_anterior /**cantidad de dias de abril */
    );
    for(let i = 1; i <= cantidad_dias_mes_anterior; i++){
      const fecha = `${numero_año_mes_anterior}-${String(numero_mes_anterior).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      const indice =
          ultimo_indice_real * (factor_diario ** i) 
      
      console.log(indice)
      try {
         await sequelize.query(
          `
          UPDATE ipc_diario
          SET indice = :indice,
              usuario_alta = :usuario_alta,
              estimado_real = :estimado_real
          WHERE fecha = :fecha
          `,
          {
            replacements: {
              indice,
              usuario_alta: "admin",
              fecha: `${fecha} 00:00:00`,
              estimado_real: "R"
            },
            type: QueryTypes.UPDATE,
          }
        );
      } catch (error) {
        console.log(error);
        return error
      } 
  
    }

    //estimados del mes ACTUAL 
    let numero_mes_actual = mes_actual.split("-")[1] /**actual seria mayo en el ejemplo */
    let numero_año_mes_actual = mes_actual.split("-")[0]
    let cantidad_dias_mes_actual = getDaysInMonth(numero_mes_actual, numero_año_mes_actual);
    const indice_estimado_actual = Math.round (indice_real_actual /*el real de abril */ * ultimo_porcentaje_ipc  * 10000) / 10000
    const factor_diario_estimado_actual = Math.pow((indice_estimado_actual / indice_real_actual), (1/cantidad_dias_mes_actual))
     for (let i = 1; i <= cantidad_dias_mes_actual; i++) {
      const fecha = `${numero_año_mes_actual}-${String(numero_mes_actual).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
  
      let diario = Math.round(indice_real_actual * (factor_diario_estimado_actual ** i) * 10000) / 10000
        try {
      await sequelize.query(
        `
        UPDATE ipc_diario 
        SET indice = :indice, 
        usuario_alta = :usuario_alta
        WHERE fecha = :fecha 
        `,
        {
          replacements: {
            indice: diario,
            usuario_alta: "admin",
            fecha: `${fecha} 00:00:00`
          },
          type: QueryTypes.UPDATE,
        }
      );
    } catch (error) {
      console.log(error);
      return error
    }
    } 


  
    //estimados mes siguiente 
    let numero_mes_siguiente = mes_siguiente.split("-")[1] /**junio */
    let numero_año_mes_siguiente = mes_siguiente.split("-")[0]
    let cantidad_dias_mes_siguiente = getDaysInMonth(numero_mes_siguiente, numero_año_mes_siguiente);
   for (let i = 1; i <= cantidad_dias_mes_siguiente; i++) {
      const indice_estimado_mes_siguiente = Math.round(indice_estimado_actual /** el estimado de mayo */ * ultimo_porcentaje_ipc * 10000) / 10000
      const factor_diario_estimado_mes_siguiente = Math.pow((indice_estimado_mes_siguiente / indice_estimado_actual), (1/cantidad_dias_mes_siguiente))
      let diario = Math.round(indice_estimado_actual * (factor_diario_estimado_mes_siguiente ** i) * 10000) / 10000
      const fecha = `${numero_año_mes_siguiente}-${String(numero_mes_siguiente).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      console.log(diario)
    // calculo el índice para ese día
     try {
      await sequelize.query(
        `
        INSERT INTO ipc_diario (indice, usuario_alta, fecha, estimado_real) VALUES (?,?,?,?)
        `,
        {
          replacements: [
            diario,
            "admin",
            `${fecha} 00:00:00`,
            "E"
          ],
          type: QueryTypes.INSERT,
        }
      );
    } catch (error) {
      console.log(error);
      return error
    }  
   }
    return "OK"

  }
}

const nuevoPorcentaje = async () => {
  let ultimo_mes_porcentaje_API;
  let ultimo_anio_porcentaje_API;
  let ultimo_mes_porcentaje_DB;
  let ultimo_anio_porcentaje_DB;
  console.log("entro a nuevoPorcentaje")
  try {
    const result = await axios.get("https://api.argly.com.ar/v1/ipc")
    console.log("ultimo porcentaje: ", result.data["data"])
    ultimo_mes_porcentaje_API = result.data["data"]["mes"] 
    ultimo_anio_porcentaje_API = result.data["data"]["anio"] 
  } catch (error) {
    console.log(error)
    return error
  }
  let ultima_fecha_real
  try {
    const result = await sequelize.query("SELECT fecha FROM IPCs ORDER BY fecha DESC LIMIT 1", {
      type: QueryTypes.SELECT
    })
    ultima_fecha_real = result[0]["fecha"]
  
  } catch (error) {
    console.log(error)
    return error
  } 
  ultimo_mes_porcentaje_DB = Number(ultima_fecha_real.split("-")[1])
  ultimo_anio_porcentaje_DB  = Number(ultima_fecha_real.split("-")[0])

const hayNuevoPorcentaje =
  ultimo_mes_porcentaje_API !== ultimo_mes_porcentaje_DB ||
  ultimo_anio_porcentaje_API !== ultimo_anio_porcentaje_DB;

return hayNuevoPorcentaje; 

}



new cron.CronJob("59 15 * * *", async function () {
  try {
    await buscarIPC2();
  } catch (error) {
    console.log(error);
  } 
});  




/*  app.get("/pruebaIPC", buscarIPC2) */