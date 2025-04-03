import nodemailer from "nodemailer";
import hbs from "nodemailer-express-handlebars";
import path from "path";
import { fileURLToPath } from "url";
import { USER_EMAIL_ID, USER_EMAIL_PASSWORD } from "../constants/constant.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const transporter = nodemailer.createTransport({
  service: "gmail",
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: USER_EMAIL_ID,
    pass: USER_EMAIL_PASSWORD,
  },
});

// Configure handlebars
const handlebarOptions = {
  viewEngine: {
    extName: ".hbs",
    partialsDir: path.join(__dirname, "../../public/template"),
    defaultLayout: false,
  },
  viewPath: path.join(__dirname, "../../public/template"),
  extName: ".hbs",
};

transporter.use("compile", hbs(handlebarOptions));

const sendEmail = async ({ to, subject, template, context }) => {
  try {
    if (!to) throw new Error("Recipient email address (to) is required");
    if (!subject) throw new Error("Email subject is required");
    if (!template) throw new Error("Template name is required");

    const mailOptions = {
      from: `"Your App Name" <${USER_EMAIL_ID}>`,
      to: Array.isArray(to) ? to : [to],
      subject,
      template,
      context,
    };

    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};

export default sendEmail;
