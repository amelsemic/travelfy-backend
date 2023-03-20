
const multer = require('multer')
const { v1: uuidv1 } = require('uuid');


const MIME_TYPE_MAP = {
    'image/png': 'png',
    'image/jpeg': 'jpeg',
    'image/jpg': 'jpg'
}

//this is GROUP OF pre-configured midlewares we are going to use

const fileUpload = multer({
    limit: 500000,                                          //upload limiit je sad 500kb
    storage: multer.diskStorage({                           //making sure what kind of files we accept. we already have filter like this on the frontend - 
                //(input has 'accept' property, BUT on the frontend everything can be hacked/changed)
        destination: (req, file, cb)=>{
            cb(null, 'uploads/images')                      //(error, pathToStoreFiles) 
            //ovaj path ce u middleware-u bit req.file.path
        },
        filename: (req, file, cb) =>{
            const ext = MIME_TYPE_MAP[file.mimetype]
            cb(null, uuidv1() + '.' + ext)                  //(error, random file name with extension)
        },
        fileFilter: (req, file, cb) => {
            const isValid = !!MIME_TYPE_MAP[file.mimetype]                 //ako file.mimetype nije jedan od onih iz naseg MIME_TYPE objekta => isValid ce bit undefined
            let error = isValid ? null : new Error ('Invalid mime type')
            cb(error, isValid)                                             //second arg is a boolean that says if we accept the file or not
        } 
    })
}) 

module.exports = fileUpload;