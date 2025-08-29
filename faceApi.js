const faceapi = require('face-api.js');
const path = require('path');
const { canvas, Canvas, Image, ImageData } = require('canvas');

// Patch face-api.js to use the canvas implementation from the 'canvas' package
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

const modelsPath = path.join(__dirname, 'models', 'face-api-models');

async function loadModels() {
    console.log('جاري تحميل نماذج التعرف على الوجه...');
    try {
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromDisk(modelsPath),
            faceapi.nets.faceLandmark68Net.loadFromDisk(modelsPath),
            faceapi.nets.faceRecognitionNet.loadFromDisk(modelsPath)
        ]);
        console.log('تم تحميل النماذج بنجاح.');
    } catch (error) {
        console.error('خطأ فادح أثناء تحميل نماذج التعرف على الوجه:', error);
        // We exit the process if models fail to load, as the app cannot function without them.
        process.exit(1); 
    }
}

module.exports = { loadModels };
