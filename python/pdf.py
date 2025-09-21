from pdf2image import convert_from_path
import os

# Checks if the output folder exists and if not it creates a new one
if not os.path.exists("extracted_images"):
    os.mkdir("extracted_images")

convert_from_path("/Users/malikmuzzammilrafiq/Downloads/4466.pdf", output_folder="extracted_images", fmt="jpeg")