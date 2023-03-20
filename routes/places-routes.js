const { check } = require("express-validator");

const express = require("express");
const router = express.Router();  

const checkAuth = require('../middleware/check-auth')

const placesControllers = require("../controllers/places-controllers");
const fileUpload = require('../middleware/file-upload')


router.get("/:pid", placesControllers.getPlaceById);
router.get("/user/:uid", placesControllers.getPlacesByUserID);



router.use(checkAuth);
//all routes bellow are protected


router.post(
  "/",
  fileUpload.single('image'), 
  check("title").not().isEmpty(),
  check("description").isLength({ min: 5 }),
  check("address").not().isEmpty(),
  placesControllers.createPlace
);

router.patch(
  "/:pid",
  check("title").not().isEmpty(),
  check("description").isLength({ min: 5 }),
  placesControllers.updatePlaceByID
);

router.delete("/:pid", placesControllers.deletePlace);


/* exportanje ovog "hendlanja razlicitih endpointa" */
module.exports = router;