const HttpError = require("../models/http-error");
const { validationResult } = require("express-validator");
const User = require("../models/user");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

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

  const createdUser = new User({
    name,
    email,
    image: req.file.path,
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
