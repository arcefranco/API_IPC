import nodemailer from "nodemailer";
import path from "path";
import hbs from "nodemailer-express-handlebars";
import dotenv from "dotenv";
dotenv.config();
const { createTransport } = nodemailer;

export const transporter = createTransport({
  //Credenciales para enviar mail
  host: "smtp.elasticemail.com",
  port: 2525,
  secure: false,
  auth: {
    user: "redes@giama.com.ar",
    pass: "6DC8116240B358533E019AECB64B9AF81838",
  },
  tls: {
    secure: false,
    ignoreTLS: true,
    rejectUnauthorized: false,
  },
});

const handlebarOptions = {
  viewEngine: {
    extName: ".handlebars",
    partialsDir: path.resolve("./views"),
    defaultLayout: false,
  },
  viewPath: path.resolve("./views"),
  extName: ".handlebars",
};

transporter.use("compile", hbs(handlebarOptions));
