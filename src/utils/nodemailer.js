/**
 * @copyright 2025 Payal Yadav
 * @license Apache-2.0
 */

import nodemailer from "nodemailer";
import hbs from "nodemailer-express-handlebars";
import nodemailerExpressHandlebars from "nodemailer-express-handlebars";
import path from "path";
import { USER_EMAIL_ID, USER_EMAIL_PASSWORD } from "../constant/constant.js";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: USER_EMAIL_ID,
    pass: USER_EMAIL_PASSWORD,
  },
});

transporter.use(
  "compile",
  hbs({
    viewEngine: {
      extName: ".hbs",
      partialsDir: path.join(process.cwd(), "public/template"),
      defaultLayout: false,
    },
    viewPath: path.join(process.cwd(), "public/template"),
    extName: ".hbs",
  })
);

const sendEmail = async ({ to, subject, template, context }) => {
  try {
    const mailOptions = {
      from: USER_EMAIL_ID,
      to,
      subject,
      template,
      context,
    };
    return await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};

export default sendEmail;
