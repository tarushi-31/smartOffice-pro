import os
import numpy as np
import matplotlib.pyplot as plt
from PIL import Image
from sklearn.model_selection import train_test_split
import tensorflow as tf
from tensorflow import keras
import zipfile
import requests
import os

def download_dataset():
    """Download the face mask dataset from Kaggle"""
    dataset_url = "https://www.kaggle.com/api/v1/datasets/download/omkargurav/face-mask-dataset"
    
    # Create data directory if it doesn't exist
    if not os.path.exists('data'):
        os.makedirs('data')
    
    # Check if dataset already exists
    if os.path.exists('data/with_mask') and os.path.exists('data/without_mask'):
        print("Dataset already exists!")
        return
    
    print("Downloading dataset...")
    # Note: You'll need to manually download the dataset from Kaggle
    # and place it in the data/ directory, or use kaggle CLI with proper authentication
    
    print("Please download the dataset manually from:")
    print("https://www.kaggle.com/datasets/omkargurav/face-mask-dataset")
    print("Extract it to the 'data/' directory")

def load_and_preprocess_data():
    """Load and preprocess the face mask dataset"""
    print("Loading and preprocessing data...")
    
    # Check if data directory exists
    if not os.path.exists('data'):
        print("Data directory not found. Please download the dataset first.")
        return None, None
    
    with_mask_path = 'data/with_mask/'
    without_mask_path = 'data/without_mask/'
    
    if not os.path.exists(with_mask_path) or not os.path.exists(without_mask_path):
        print("Dataset not found in expected location.")
        return None, None
    
    with_mask_files = os.listdir(with_mask_path)
    without_mask_files = os.listdir(without_mask_path)
    
    print(f'Number of with mask images: {len(with_mask_files)}')
    print(f'Number of without mask images: {len(without_mask_files)}')
    
    # Create labels
    with_mask_labels = [1] * len(with_mask_files)
    without_mask_labels = [0] * len(without_mask_files)
    
    labels = with_mask_labels + without_mask_labels
    
    # Load and preprocess images
    data = []
    
    print("Processing with mask images...")
    for img_file in with_mask_files:
        try:
            image = Image.open(os.path.join(with_mask_path, img_file))
            image = image.resize((128, 128))
            image = image.convert('RGB')
            image = np.array(image)
            data.append(image)
        except Exception as e:
            print(f"Error processing {img_file}: {e}")
    
    print("Processing without mask images...")
    for img_file in without_mask_files:
        try:
            image = Image.open(os.path.join(without_mask_path, img_file))
            image = image.resize((128, 128))
            image = image.convert('RGB')
            image = np.array(image)
            data.append(image)
        except Exception as e:
            print(f"Error processing {img_file}: {e}")
    
    X = np.array(data)
    Y = np.array(labels)
    
    print(f"Final dataset shape: {X.shape}")
    print(f"Labels shape: {Y.shape}")
    
    return X, Y

def create_model():
    """Create the CNN model for face mask detection"""
    print("Creating model...")
    
    num_of_classes = 2
    
    model = keras.Sequential([
        keras.layers.Input(shape=(128, 128, 3)),
        keras.layers.Conv2D(32, kernel_size=(3, 3), activation='relu'),
        keras.layers.MaxPooling2D(pool_size=(2, 2)),
        
        keras.layers.Conv2D(64, kernel_size=(3, 3), activation='relu'),
        keras.layers.MaxPooling2D(pool_size=(2, 2)),
        
        keras.layers.Flatten(),
        keras.layers.Dense(128, activation='relu'),
        keras.layers.Dropout(0.5),
        keras.layers.Dense(64, activation='relu'),
        keras.layers.Dropout(0.5),
        keras.layers.Dense(num_of_classes, activation='softmax')
    ])
    
    model.compile(
        optimizer='adam',
        loss='sparse_categorical_crossentropy',
        metrics=['accuracy']
    )
    
    return model

def train_model(model, X, Y):
    """Train the model"""
    print("Training model...")
    
    # Split data
    X_train, X_test, Y_train, Y_test = train_test_split(X, Y, test_size=0.2, random_state=2)
    
    # Scale data
    X_train_scaled = X_train / 255.0
    X_test_scaled = X_test / 255.0
    
    print(f"Training set shape: {X_train.shape}")
    print(f"Test set shape: {X_test.shape}")
    
    # Train model
    history = model.fit(
        X_train_scaled, Y_train,
        validation_split=0.1,
        epochs=10,
        batch_size=32,
        verbose=1
    )
    
    # Evaluate model
    loss, accuracy = model.evaluate(X_test_scaled, Y_test, verbose=0)
    print(f'Test Accuracy: {accuracy:.4f}')
    
    return history, X_test_scaled, Y_test

def save_model(model, history):
    """Save the trained model and training history"""
    print("Saving model...")
    
    # Create models directory if it doesn't exist
    if not os.path.exists('models'):
        os.makedirs('models')
    
    # Save model
    model.save('models/face_mask_detection_model.h5')
    
    # Save training history
    np.save('models/training_history.npy', history.history)
    
    print("Model saved successfully!")

def plot_training_history(history):
    """Plot training history"""
    print("Plotting training history...")
    
    # Create plots directory if it doesn't exist
    if not os.path.exists('plots'):
        os.makedirs('plots')
    
    # Plot loss
    plt.figure(figsize=(12, 4))
    
    plt.subplot(1, 2, 1)
    plt.plot(history.history['loss'], label='Training Loss')
    plt.plot(history.history['val_loss'], label='Validation Loss')
    plt.title('Model Loss')
    plt.xlabel('Epoch')
    plt.ylabel('Loss')
    plt.legend()
    
    # Plot accuracy
    plt.subplot(1, 2, 2)
    plt.plot(history.history['accuracy'], label='Training Accuracy')
    plt.plot(history.history['val_accuracy'], label='Validation Accuracy')
    plt.title('Model Accuracy')
    plt.xlabel('Epoch')
    plt.ylabel('Accuracy')
    plt.legend()
    
    plt.tight_layout()
    plt.savefig('plots/training_history.png', dpi=300, bbox_inches='tight')
    plt.show()

def main():
    """Main function to run the training pipeline"""
    print("=== Face Mask Detection Model Training ===")
    
    # Download dataset
    download_dataset()
    
    # Load and preprocess data
    X, Y = load_and_preprocess_data()
    
    if X is None or Y is None:
        print("Failed to load data. Exiting.")
        return
    
    # Create model
    model = create_model()
    
    # Train model
    history, X_test, Y_test = train_model(model, X, Y)
    
    # Save model
    save_model(model, history)
    
    # Plot training history
    plot_training_history(history)
    
    print("Training completed successfully!")

if __name__ == "__main__":
    main()
