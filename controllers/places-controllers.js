const HttpError = require("../models/http-error");
const { v4: uuidv4 } = require("uuid");
const { validationResult } = require("express-validator");
const getCoordsForAdress = require("../utils/location");
const Place = require("../models/place");
const User = require("../models/user");
const mongoose = require("mongoose");
/* const { use } = require("../routes/places-routes"); */
const fs = require("fs");

//DigitalOcean pokusaj sa chatGPT
const AWS = require('aws-sdk');

// Set up the AWS SDK with your Spaces access keys
const spacesEndpoint = new AWS.Endpoint('fra1.digitaloceanspaces.com');
const s3 = new AWS.S3({
  endpoint: spacesEndpoint,
  accessKeyId: 'DO00QQR9Z3XWJ7CDJ67J',
  secretAccessKey: 'czENNVSTkgsVDEzK5mRpkUnTd3vPtNRQTwc2JzR0v34',
});



//BLOB pokusaj sa chatGPT
/* const { BlobServiceClient } = require("@azure/storage-blob");

const blobServiceClient = BlobServiceClient.fromConnectionString(
  "DefaultEndpointsProtocol=https;AccountName=mern;AccountKey=YRExv5+8pC0ugGh97UttFdIZ+8qpS7hIE//+/hzgn6VadpT9sjo/r5yKmz7mf65RWpBOvNuyMgwz+AStlgO1rg==;EndpointSuffix=core.windows.net"
);
const containerClient = blobServiceClient.getContainerClient("mern");
 */


const getPlacesByUserID = async (req, res, next) => {
  const userId = req.params.uid;
  let places;
  try {
    places = await Place.find({ creator: userId }).exec();
  } catch (err) {
    const error = new HttpError("Fetching failed, please try again", 500);
    return next(error);
  }

  if (!places || places.length === 0) {
    return next(
      new HttpError("Couldnt find a places for provided userID", 404)
    );
  }
  res.json({
    places: places.map((place) => place.toObject({ getters: true })),
  });
};

const getPlaceById = async (req, res, next) => {
  const placeId = req.params.pid;

  let place;
  try {
    place = await Place.findById(placeId).exec();
  } catch (err) {
    const error = new HttpError(
      "Something went wrong, couldnt find a place",
      500
    );
    return next(error);
  }

  if (!place) {
    const error = new HttpError("Couldnt find a place for provided ID", 404);
    return next(error);
  }
  res.json({ place: place.toObject({ getters: true }) });
};

const createPlace = async (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    throw new HttpError("Invalid inputs passed, please check your data!");
  }

  const coordinates = getCoordsForAdress(); /* dummy version */

  const { title, description, address } = req.body;

  //DigitalOcean

  const { filename, path } = req.file;

  const uploadParams = {
    Bucket: 'myfirstspaceamel',
    Key: filename,
    Body: fs.createReadStream(path),
    ACL: 'public-read', // Set the access control level as 'public-read' to make the image publicly accessible
  };

  try{
    await s3.upload(uploadParams).promise();
  } catch(err){
    const error = new HttpError("Failed to upload image", 500);
    return next(error);
  }

  //kraj



  //step4 sa GPT
/*   const path = req.file.path;

  const blockBlobClient = containerClient.getBlockBlobClient(
    title + path.slice(15, 30) + ".jpg"
  );

  const data = fs.readFileSync(path);
  const buffer = Buffer.from(data);

  const uploadBlobResponse = await blockBlobClient.upload(data, data.length); */
  //kraj


  const createdPlace = new Place({
    //moongoose schema Place preko koje uploadamo nase Places
    title,
    description,
    address,
    location: coordinates,
    image: `https://myfirstspaceamel.fra1.cdn.digitaloceanspaces.com/${req.file.filename}`,
    creator: req.userData.userId,
  });

  let user;
  try {
    user = await User.findById(req.userData.userId);
  } catch (err) {
    const error = new HttpError("Creating place failed, please try again", 500);
    return next(error);
  }

  if (!user) {
    const error = new HttpError("Couldnt find user for provided ID", 404);
    return next(error);
  }

  try {
    const session = await mongoose.startSession();
    session.startTransaction();

    await createdPlace.save({ session: session });
    user.places.push(createdPlace); //dodaje samo ID od createdPlace u"places" property od usera
    await user.save({ session: session });

    await session.commitTransaction();
  } catch (err) {
    const error = new HttpError("Creating place failed, please try again", 500);
    return next(error);
  }

  res.status(201).json({ place: createdPlace });
};

const updatePlaceByID = async (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return next(
      new HttpError("Invalid inputs passed, please check your data!")
    );
  }

  const { title, description } = req.body;
  const placeID = req.params.pid;

  let place;
  try {
    place = await Place.findById(placeID);
  } catch (err) {
    const error = new HttpError("Smthng went wrong, couldnt update place", 500);
    return next(error);
  }

  if (place.creator.toString() !== req.userData.userId) {
    //da li je ovaj user napravio ovaj place

    const error = new HttpError("You are not allowed to edit this place!", 401);
    return next(error);
  }

  place.title = title;
  place.description = description;

  try {
    await place.save();
  } catch (err) {
    const error = new HttpError("Smthng went wrong, couldnt update place", 500);
    return next(error);
  }

  res.status(200).json({ place: place });
};

const deletePlace = async (req, res, next) => {
  const placeID = req.params.pid;

  let place;
  try {
    place = await Place.findById(placeID).populate("creator");
  } catch (err) {
    const error = new HttpError("Smthng went wrong, couldnt delete place", 500);
    return next(error);
  }

  if (!place) {
    const error = new HttpError("Couldnt find place for this ID", 404);
    return next(error);
  }

  //ovdje cemo koristiti place.creator.id jer kod delete place imamo citav user objekat, nije kao kod update place => pogledati pocetak lekcije 187
  if (place.creator.id !== req.userData.userId) {
    const error = new HttpError(
      "You are not allowed to delete this place!",
      401
    );
    return next(error);
  }

  const imagePath = place.image;

  try {
    const session = await mongoose.startSession();
    session.startTransaction();

    await place.remove({ session: session });

    place.creator.places.pull(place); //pull will automatically delete just one ID from places
    await place.creator.save({ session: session });

    await session.commitTransaction();
    console.log("Deleting place");
  } catch (err) {
    const error = new HttpError("Smthng went wrong, couldnt delete place", 500);
    return next(error);
  }

  //brisanje slike nakon brisanja mjesta
  fs.unlink(imagePath, (err) => console.log(err));

  res.status(200).json({ message: "Place deleted." });
};

exports.createPlace = createPlace;
exports.getPlaceById = getPlaceById;
exports.getPlacesByUserID = getPlacesByUserID;
exports.updatePlaceByID = updatePlaceByID;
exports.deletePlace = deletePlace;
