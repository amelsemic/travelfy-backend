const express = require("express");
const bodyParser = require("body-parser");
const HttpError = require("./models/http-error");
const placesRoutes = require("./routes/places-routes");
const usersRoutes = require("./routes/users-routes");
const mongoose = require("mongoose");
const fs = require("fs"); // this allows us to interact (for example delete) with files
const path = require('path')

const app = express(); /* pokretanje express frameworka */

app.use(bodyParser.json()); /* bodyParsanje uvijek na prvom mjestu */


app.use('/uploads/images', express.static(path.join('uploads', 'images')))

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE");
  next();
});

app.use("/api/places", placesRoutes);
app.use("/api/users", usersRoutes); /* hendlanje razlicitih  endpoint-a*/




/* kupi requestove sa undefined routes */
app.use((req, res, next) => {
  const error = new HttpError("Coulnd not find this route", 404);
  throw error;
});

/* kupi errore koji su throw-ani iz requestova */
app.use((error, req, res, next) => {
  if (req.file) {
    //request that failed/hadError (we know it failed beause we reached this mdwr) had a file
    //and now we want to delete that file which is stored somewhere even though request failed
    fs.unlink(req.file.path, (err) => {
      console.log(err);
    });
  }

  if (res.headerSent) {
    return next(error);
  }
  res
    .status(error.code || 500) //samo ako je 200 => res.ok == true
    .json({ message: error.message || "An unknown error occured..." }); //ono sto cemo dobiti kao data = await res.json
});

mongoose.set("strictQuery", false);
mongoose
  .connect(
    `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.cnozerd.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`
  ) //mern ubaceno
  .then(() => {
    app.listen(5000);
    console.log("connected to database!!");
  })
  .catch((err) => {
    console.log(err);
  });
