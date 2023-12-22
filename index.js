import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import axios from "axios";
import path, { dirname } from "path";
import dotenv from "dotenv";
import { Sequelize, DataTypes } from "sequelize";

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
