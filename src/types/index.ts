export interface ScreenData {
    image: string; // Base64 encoded image data of the mirrored screen
    timestamp: number; // Timestamp of when the screen data was captured
}

export interface TextDetectionResult {
    percentage: number; // Percentage of text detected in the screen data
    detectedText: string[]; // Array of detected text strings
}