import { transporter } from "./transporter.js";
import dotenv from "dotenv";
dotenv.config();

export const sendEmail = async (email) => {
  try {
    transporter.sendMail({
      //Envio el mail a la casilla que encontramos segun su nombre de usuario
      from: "info@giama.com.ar",
      to: email,
      subject: "Actualización de la tabla IPC",
      template: "index",
    });
  } catch (error) {
    console.log(error);
    return JSON.stringify(error);
  }
};
