import os
import cv2
import numpy as np
from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
import tensorflow as tf
from PIL import Image
import base64
import io
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Configure upload folder
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Load the trained model
model = None
try:
    # Try different possible paths for the model
    model_paths = [
        'models/face_mask_detection_model.h5',
        '../models/face_mask_detection_model.h5',
        '../../models/face_mask_detection_model.h5'
    ]
    
    for model_path in model_paths:
        if os.path.exists(model_path):
            model = tf.keras.models.load_model(model_path)
            logger.info(f"Model loaded successfully from {model_path}!")
            break
    
    if model is None:
        logger.error("Model not found in any expected location!")
        logger.error("Please ensure the model exists at models/face_mask_detection_model.h5")
        
except Exception as e:
    logger.error(f"Error loading model: {e}")
    logger.error("Please train the model first using train_model.py")

def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def preprocess_image(image_path):
    """Preprocess image for model prediction"""
    try:
        # Read image
        image = cv2.imread(image_path)
        if image is None:
            return None, None
        
        # Resize to 128x128
        image_resized = cv2.resize(image, (128, 128))
        
        # Convert BGR to RGB
        image_rgb = cv2.cvtColor(image_resized, cv2.COLOR_BGR2RGB)
        
        # Normalize
        image_normalized = image_rgb / 255.0
        
        # Reshape for model input
        image_reshaped = np.expand_dims(image_normalized, axis=0)
        
        return image_reshaped, image
    except Exception as e:
        logger.error(f"Error preprocessing image: {e}")
        return None, None

def predict_mask(image_path):
    """Predict if person is wearing mask or not"""
    if model is None:
        return None, "Model not loaded. Please train the model first."
    
    try:
        # Preprocess image
        processed_image, original_image = preprocess_image(image_path)
        
        if processed_image is None:
            return None, "Error processing image"
        
        # Make prediction
        prediction = model.predict(processed_image, verbose=0)
        
        # Get prediction probabilities
        mask_prob = prediction[0][1]  # Probability of wearing mask
        no_mask_prob = prediction[0][0]  # Probability of not wearing mask
        
        # Get prediction label
        pred_label = np.argmax(prediction[0])
        
        # Determine result
        if pred_label == 1:
            result = "Wearing Mask"
            confidence = mask_prob
        else:
            result = "Not Wearing Mask"
            confidence = no_mask_prob
        
        return {
            'result': result,
            'confidence': float(confidence),
            'mask_probability': float(mask_prob),
            'no_mask_probability': float(no_mask_prob)
        }, None
        
    except Exception as e:
        logger.error(f"Error during prediction: {str(e)}")
        return None, f"Error during prediction: {str(e)}"

@app.route('/health')
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'model_loaded': model is not None,
        'service': 'ai-prediction-service'
    })

@app.route('/upload', methods=['POST'])
def upload_file():
    """Handle file upload and prediction"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if file and allowed_file(file.filename):
            # Secure filename and save
            filename = secure_filename(file.filename)
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)
            
            # Make prediction
            prediction, error = predict_mask(filepath)
            
            if error:
                return jsonify({'error': error}), 500
            
            # Convert image to base64 for display
            with open(filepath, 'rb') as img_file:
                img_data = base64.b64encode(img_file.read()).decode('utf-8')
            
            # Clean up uploaded file
            os.remove(filepath)
            
            return jsonify({
                'success': True,
                'prediction': prediction,
                'image': img_data,
                'filename': filename
            })
        
        else:
            return jsonify({'error': 'Invalid file type'}), 400
            
    except Exception as e:
        logger.error(f"Server error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/webcam', methods=['POST'])
def webcam_prediction():
    """Handle webcam image prediction"""
    try:
        # Get base64 image data from request
        data = request.get_json()
        if not data or 'image' not in data:
            return jsonify({'error': 'No image data received'}), 400
        
        # Decode base64 image
        image_data = data['image'].split(',')[1]  # Remove data:image/jpeg;base64, prefix
        image_bytes = base64.b64decode(image_data)
        
        # Save temporary image
        temp_path = os.path.join(app.config['UPLOAD_FOLDER'], 'temp_webcam.jpg')
        with open(temp_path, 'wb') as f:
            f.write(image_bytes)
        
        # Make prediction
        prediction, error = predict_mask(temp_path)
        
        # Clean up
        os.remove(temp_path)
        
        if error:
            return jsonify({'error': error}), 500
        
        return jsonify({
            'success': True,
            'prediction': prediction
        })
        
    except Exception as e:
        logger.error(f"Webcam prediction error: {str(e)}")
        return jsonify({'error': f'Server error: {str(e)}'}), 500

if __name__ == '__main__':
    logger.info("Starting AI Prediction Service...")
    logger.info("Make sure you have trained the model first using train_model.py")
    app.run(debug=False, host='0.0.0.0', port=5000)
