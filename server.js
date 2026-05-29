const PDFDocument =
  require("pdfkit");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const multer = require("multer");
const fs = require("fs");
const http = require("http");

const pool = require("./db");
const authMiddleware =
  require("./authMiddleware");

const app = express();

const server =
  http.createServer(app);

const { Server } =
  require("socket.io");

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

app.use(cors());
app.use(express.json());

const upload = multer({
  dest: "uploads/",
});


// SOCKET CONNECTION
io.on("connection", (socket) => {

  console.log(
    "User connected"
  );

  socket.on(
    "disconnect",
    () => {

      console.log(
        "User disconnected"
      );
    }
  );
});


// HOME
app.get("/", (req, res) => {

  res.send(
    "PACS Backend Running"
  );
});


// REGISTER
app.post(
  "/register",
  async (req, res) => {

    try {

      const {
        username,
        password,
        role,
      } = req.body;

      const hashedPassword =
        await bcrypt.hash(
          password,
          10
        );

      const result =
        await pool.query(
          `
          INSERT INTO users
          (
            username,
            password,
            role
          )
          VALUES ($1, $2, $3)
          RETURNING *
          `,
          [
            username,
            hashedPassword,
            role,
          ]
        );

      res.json({
        message:
          "User registered",
        user:
          result.rows[0],
      });

    } catch (err) {

      console.log(err);

      res.status(500).json({
        message:
          "Server error",
      });
    }
  }
);
//admin
app.get(
  "/create-admin",
  async (req, res) => {

    try {

      const hashedPassword =
        await bcrypt.hash(
          "admin123",
          10
        );

      await pool.query(
        `
        INSERT INTO users
        (
          username,
          password,
          role
        )
        VALUES
        ($1,$2,$3)
        `,
        [
          "superadmin",
          hashedPassword,
          "admin",
        ]
      );

      res.send(
        "Admin created"
      );

    } catch (err) {

      console.log(err);

      res.send(
        "Error creating admin"
      );
    }
  }
);

// LOGIN
app.post(
  "/login",
  async (req, res) => {

    try {

      const {
        username,
        password,
      } = req.body;

      const result =
        await pool.query(
          `
          SELECT *
          FROM users
          WHERE username = $1
          `,
          [username]
        );

      if (
        result.rows.length === 0
      ) {

        return res
          .status(401)
          .json({
            message:
              "Invalid username",
          });
      }

      const user =
        result.rows[0];

      const validPassword =
        await bcrypt.compare(
          password,
          user.password
        );

      if (!validPassword) {

        return res
          .status(401)
          .json({
            message:
              "Invalid password",
          });
      }

      const token =
        jwt.sign(
          {
            id: user.id,
            role: user.role,
          },
          process.env.JWT_SECRET
        );

      res.json({
        message:
          "Login successful",
        token,
        user,
      });

    } catch (err) {

      console.log(err);

      res.status(500).json({
        message:
          "Server error",
      });
    }
  }
);


// GET STUDIES
app.get(
  "/my-studies",
  authMiddleware,
  async (req, res) => {

    try {

      const userId =
        req.user.id;

      const role =
        req.user.role;

      let result;

      if (
        role === "doctor"
      ) {

        const doctorResult =
          await pool.query(
            `
            SELECT username
            FROM users
            WHERE id = $1
            `,
            [userId]
          );

        const doctorUsername =
          doctorResult.rows[0]
            .username;

        result =
          await pool.query(
            `
            SELECT *
            FROM studies
            WHERE assigned_doctor = $1
            ORDER BY id DESC
            `,
            [doctorUsername]
          );

      } else {

        result =
          await pool.query(
            `
            SELECT *
            FROM studies
            WHERE uploaded_by = $1
            ORDER BY id DESC
            `,
            [userId]
          );
      }

      res.json(
        result.rows
      );

    } catch (err) {

      console.log(err);

      res.status(500).json({
        message:
          "Server error",
      });
    }
  }
);
// GET ALL DOCTORS
app.get(
  "/doctors",
  async (req, res) => {

    try {

      const result =
        await pool.query(
          `
          SELECT
            id,
            username
          FROM users
          WHERE role = 'doctor'
          ORDER BY username
          `
        );

      res.json(
        result.rows
      );

    } catch (err) {

      console.log(err);

      res.status(500).json({
        message:
          "Failed to fetch doctors",
      });
    }
  }
);
// GET ALL USERS
app.get(
  "/users",
  async (req, res) => {

    try {

      const result =
        await pool.query(
          `
          SELECT
            id,
employee_id,
full_name,
            username,
            role
          FROM users
          ORDER BY id
          `
        );

      res.json(
        result.rows
      );

    } catch (err) {

      console.log(err);

      res.status(500).json({
        message:
          "Failed to fetch users",
      });
    }
  }
);
// CREATE USER
app.post(
  "/create-user",
  async (req, res) => {

    try {

const {
  employee_id,
  full_name,
  username,
  password,
  role,
} = req.body;

      const hashedPassword =
        await bcrypt.hash(
          password,
          10
        );

const result =
  await pool.query(
    `
    INSERT INTO users
    (
      employee_id,
      full_name,
      username,
      password,
      role
    )
    VALUES
    ($1,$2,$3,$4,$5)
    RETURNING
    id,
    employee_id,
    full_name,
    username,
    role
    `,
    [
      employee_id,
      full_name,
      username,
      hashedPassword,
      role,
    ]
  );
      res.json({
        message:
          "User created",
        user:
          result.rows[0],
      });

    } catch (err) {

      console.log(err);

      res.status(500).json({
        message:
          "Failed to create user",
      });
    }
  }
);
// ADD REPORT
app.put(
  "/add-report/:id",
  async (req, res) => {

    try {

      const { id } =
        req.params;

      const { report } =
        req.body;

      await pool.query(
        `
        UPDATE studies
        SET report = $1
        WHERE id = $2
        `,
        [report, id]
      );

      res.json({
        message:
          "Report saved successfully",
      });

    } catch (err) {

      console.log(err);

      res.status(500).json({
        message:
          "Server error",
      });
    }
  }
);


// MARK REVIEWED
app.put(
  "/mark-reviewed/:id",
  async (req, res) => {

    try {

      const { id } =
        req.params;

      const result =
        await pool.query(
          `
          UPDATE studies
          SET reviewed = TRUE
          WHERE id = $1
          RETURNING *
          `,
          [id]
        );

      io.emit(
        "study-reviewed",
        {
          studyId: id,
        }
      );

      res.json({
        message:
          "Study reviewed successfully",
        data:
          result.rows[0],
      });

    } catch (err) {

      console.log(err);

      res.status(500).json({
        message:
          "Server error",
      });
    }
  }
);
// SEND BACK TO RADIOLOGIST
app.put(
  "/send-back/:id",
  async (req, res) => {

    try {

      const { id } =
        req.params;

      const result =
        await pool.query(
          `
          UPDATE studies
          SET
            returned_to_radiologist = TRUE,
            status = 'Returned'
          WHERE id = $1
          RETURNING *
          `,
          [id]
        );

      io.emit(
        "study-returned",
        {
          studyId: id,
        }
      );

      res.json({
        message:
          "Study returned successfully",
        data:
          result.rows[0],
      });

    } catch (err) {

      console.log(err);

      res.status(500).json({
        message:
          "Server error",
      });
    }
  }
);
// DOWNLOAD PDF REPORT
app.get(
  "/download-report/:id",
  async (req, res) => {

    try {

      const { id } =
        req.params;

      const result =
        await pool.query(
          `
          SELECT *
          FROM studies
          WHERE id = $1
          `,
          [id]
        );

      const study =
        result.rows[0];

      if (!study) {

        return res
          .status(404)
          .json({
            message:
              "Study not found",
          });
      }

      // PDF
      const doc =
        new PDFDocument();

      res.setHeader(
        "Content-Type",
        "application/pdf"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename=report-${id}.pdf`
      );

      doc.pipe(res);

      // TITLE
      doc
        .fontSize(26)
        .text(
          "Radiology Report",
          {
            align: "center",
          }
        );

      doc.moveDown();

      // PATIENT INFO
      doc
        .fontSize(18)
        .text(
          `Patient Name: ${study.patient_name}`
        );

      doc.moveDown();

      doc.text(
        `Study Description: ${study.study_description}`
      );

      doc.moveDown();

      doc.text(
        `Status: ${study.status}`
      );

      doc.moveDown();

      doc.text(
        `Reviewed: ${
          study.reviewed
            ? "Yes"
            : "No"
        }`
      );

      doc.moveDown();

      // REPORT
      doc
        .fontSize(20)
        .text("Findings");

      doc.moveDown();

      doc
        .fontSize(14)
        .text(
          study.report ||
          "No report available"
        );

      doc.moveDown(2);

      doc
        .fontSize(12)
        .text(
          `Generated on: ${new Date().toLocaleString()}`
        );

      doc.end();

    } catch (err) {

      console.log(err);

      res.status(500).json({
        message:
          "Server error",
      });
    }
  }
);
// DELETE USER
app.delete(
  "/delete-user/:id",
  async (req, res) => {

    try {

      const { id } =
        req.params;

      await pool.query(
        `
        DELETE FROM users
        WHERE id = $1
        `,
        [id]
      );

      res.json({
        message:
          "User deleted",
      });

    } catch (err) {

      console.log(err);

      res.status(500).json({
        message:
          "Delete failed",
      });
    }
  }
);
// DELETE STUDY
app.delete(
  "/delete-study/:id",
  async (req, res) => {

    try {

      const { id } =
        req.params;

      console.log(
        "Deleting study:",
        id
      );

      const result =
        await pool.query(
          `
          DELETE FROM studies
          WHERE id = $1
          RETURNING *
          `,
          [id]
        );

      console.log(
        "DELETED:",
        result.rows
      );

      io.emit(
        "study-deleted",
        {
          studyId: id,
        }
      );

      res.json({
        message:
          "Study deleted successfully",
      });

    } catch (err) {

      console.log(
        "DELETE ERROR:"
      );

      console.log(err);

      res.status(500).json({
        message:
          "Server error",
      });
    }
  }
);

// UPLOAD DICOM
app.post(
  "/upload-dicom",
  upload.single("dicom"),
  async (req, res) => {

    try {

      const {
        assignedDoctor,
      } = req.body;

      const filePath =
        req.file.path;

      const dicomBuffer =
        fs.readFileSync(
          filePath
        );

      const orthancResponse =
        await axios.post(
          "https://pacs.image3dreport.com/instances",
          dicomBuffer,
          {
            headers: {
              "Content-Type":
                "application/dicom",
            },

            auth: {
              username:
                "orthanc",
              password:
                "orthanc",
            },
          }
        );

      const parentStudy =
        orthancResponse.data
          .ParentStudy;

      const instanceId =
        orthancResponse.data
          .ID;

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            2000
          )
      );

      const studyResponse =
        await axios.get(
          `https://pacs.image3dreport.com/studies/${parentStudy}`,
          {
            auth: {
              username:
                "orthanc",
              password:
                "orthanc",
            },
          }
        );

      const studyTags =
        studyResponse.data
          .MainDicomTags;

      const patientTags =
        studyResponse.data
          .PatientMainDicomTags;

      const studyInstanceUID =
        studyTags
          .StudyInstanceUID;

      const patientName =
        patientTags.PatientName ||
        "Unknown";

      const studyDescription =
        studyTags
          .StudyDescription ||
        "Unknown";

      const token =
        req.headers
          .authorization;

      const decoded =
        jwt.verify(
          token,
          process.env.JWT_SECRET
        );

      await pool.query(
        `
        INSERT INTO studies
        (
          patient_name,
          study_description,
          orthanc_study_id,
          study_instance_uid,
          thumbnail_instance_id,
          uploaded_by,
          assigned_doctor,
          status
        )
        VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8)
        `,
        [
          patientName,
          studyDescription,
          parentStudy,
          studyInstanceUID,
          instanceId,
          decoded.id,
          assignedDoctor,
          "Pending",
        ]
      );

      fs.unlinkSync(
        filePath
      );

      io.emit(
        "new-study",
        {
          patientName,
          studyDescription,
        }
      );

      res.json({
        message:
          "DICOM uploaded successfully",
      });

    } catch (err) {

      console.log(err);

      res.status(500).json({
        message:
          "Upload failed",
      });
    }
  }
);
//testing
app.get(
  "/all-studies",
  async (req, res) => {

    try {

      const result =
        await pool.query(
          `
          SELECT *
          FROM studies
          ORDER BY id DESC
          `
        );

      res.json(
        result.rows
      );

    } catch (err) {

      console.log(err);

      res.status(500).json({
        message:
          "Error",
      });
    }
  }
);
// DEBUG - GET ALL STUDIES
app.get(
  "/all-studies",
  async (req, res) => {

    try {

      const result =
        await pool.query(
          `
          SELECT *
          FROM studies
          ORDER BY id DESC
          `
        );

      res.json(
        result.rows
      );

    } catch (err) {

      console.log(err);

      res.status(500).json({
        message:
          "Error fetching studies",
      });
    }
  }
);
//debug _users
app.get(
  "/debug-users",
  async (req, res) => {

    const result =
      await pool.query(
        `
        SELECT
          id,
          username,
          role
        FROM users
        `
      );

    res.json(
      result.rows
    );
  }
);
// START SERVER
server.listen(
  5000,
  () => {

    console.log(
      "Server running on port 5000"
    );
  }
);