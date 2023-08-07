const HttpError = require("../models/http-error");
const { validationResult } = require("express-validator");
const User = require("../models/user");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("fs");

//DigitalOcean pokusaj sa chatGPT
const AWS = require("aws-sdk");

// Set up the AWS SDK with your Spaces access keys
const spacesEndpoint = new AWS.Endpoint("fra1.digitaloceanspaces.com");
const s3 = new AWS.S3({
  endpoint: spacesEndpoint,
  accessKeyId: "DO00QQR9Z3XWJ7CDJ67J",
  secretAccessKey: "czENNVSTkgsVDEzK5mRpkUnTd3vPtNRQTwc2JzR0v34",
});

const getUsers = async (req, res, next) => {
  let users;
  try {
    users = await User.find({}, "-password");
  } catch (err) {
    return next(new HttpError("Fetching users failed", 500));
  }

  res.json({ users });
};

const signUp = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError("Invalid inputs passed, please check your data.")
    );
  }

  const { name, email, password } = req.body;

  let existingUser;
  try {
    existingUser = await User.findOne({ email: email });
  } catch (err) {
    const error = new HttpError("Signing up failed, please try again", 500);
    return next(error);
  }

  if (existingUser) {
    const error = new HttpError(
      "User exists already, please login instead",
      422
    );
    return next(error);
  }

  let hashedPassword;
  try {
    hashedPassword = await bcrypt.hash(password, 12);
  } catch (err) {
    const error = new HttpError("Signing up failed, please try again", 500);
    return next(error);
  }

  //DigitalOcean

  const { filename, path } = req.file;
  const uploadParams = {
    Bucket: "myfirstspaceamel",
    Key: filename,
    Body: fs.createReadStream(path),
    ACL: "public-read", // Set the access control level as 'public-read' to make the image publicly accessible
  };

  try {
    await s3.upload(uploadParams).promise();
  } catch (err) {
    const error = new HttpError("Failed to upload image", 500);
    return next(err);
  }

  //kraj

  const createdUser = new User({
    name,
    email,
    image: `https://myfirstspaceamel.fra1.cdn.digitaloceanspaces.com/${req.file.filename}`,
    password: hashedPassword,
    places: [],
  });

  try {
    await createdUser.save(); //pokusaj spasavanja na DB
  } catch (err) {
    const error = new HttpError("Signing up failed, please try again", 500);
    return next(error);
  }

  let token;
  try {
    token = jwt.sign(
      { userId: createdUser.id, email: createdUser.email },
      process.env.JWT_KEY, //private_key
      { expiresIn: "1h" } // extra_security mechanism, optional
    ); //returns a string - token
  } catch (err) {
    const error = new HttpError("Signing up failed, please try again", 500);
    return next(error);
  }

  res
    .status(201)
    .json({ userId: createdUser.id, email: createdUser.email, token });
};

const logIn = async (req, res, next) => {
  const { email, password } = req.body;

  let existingUser;
  try {
    existingUser = await User.findOne({ email: email });
  } catch (err) {
    const error = new HttpError("Logging  in failed, please try again", 500);
    return next(error);
  }

  if (!existingUser) {
    return next(
      new HttpError("Invalid credentials, could not log you in...", 403)
    );
  }

  let isValidPw;
  try {
    isValidPw = await bcrypt.compare(password, existingUser.password);
  } catch (err) {
    const error = new HttpError("Logging  in failed, please try again", 500);
    return next(error);
  }

  if (!isValidPw) {
    return next(
      new HttpError("Invalid credentials, could not log you in...", 401)
    );
  }

  let token;
  try {
    token = jwt.sign(
      { userId: existingUser.id, email: existingUser.email },
      process.env.JWT_KEY,
      { expiresIn: "1h" } // extra_security mechanism, optional
    ); //returns a string - token
  } catch (err) {
    const error = new HttpError("Logging in failed, please try again", 500);
  }

  res.json({
    userId: existingUser.id,
    email: existingUser.email,
    token: token,
  });
};

exports.getUsers = getUsers;
exports.signUp = signUp;
exports.logIn = logIn;
