//
//  FoodAnalyzer.swift
//  chewy
//

import UIKit

// MARK: - Protocol

protocol FoodAnalyzerService {
    func analyze(image: UIImage) async throws -> FoodAnalysisResult
}

// MARK: - Result

struct FoodAnalysisResult {
    let name: String
    let kcal: Int?
    let protein: Double?  // g
    let carbs: Double?    // g
    let fat: Double?      // g
    let description: String
}

// MARK: - Mock (dev / previews)

final class MockFoodAnalyzer: FoodAnalyzerService {
    func analyze(image: UIImage) async throws -> FoodAnalysisResult {
        try await Task.sleep(for: .seconds(1.5))
        return FoodAnalysisResult(
            name: "Grilled Chicken Salad",
            kcal: 320,
            protein: 28,
            carbs: 12,
            fat: 18,
            description: "Mixed greens with grilled chicken, cherry tomatoes, and light vinaigrette."
        )
    }
}

// MARK: - Gemini

final class GeminiFoodAnalyzer: FoodAnalyzerService {
    private let apiKey: String
    private let model = "gemini-2.5-flash"

    init(apiKey: String) {
        self.apiKey = apiKey
    }

    func analyze(image: UIImage) async throws -> FoodAnalysisResult {
        guard let jpegData = image.resized(maxSide: 768).jpegData(compressionQuality: 0.7) else {
            throw AnalyzerError.imageEncodingFailed
        }

        let url = URL(string:
            "https://generativelanguage.googleapis.com/v1beta/models/\(model):generateContent?key=\(apiKey)"
        )!

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let prompt = """
        Analyze this food image. Respond with ONLY valid JSON, no markdown, no extra text:
        {
          "name": "food name in English",
          "kcal": 350,
          "protein_g": 25.0,
          "carbs_g": 30.0,
          "fat_g": 12.0,
          "description": "one sentence description"
        }
        If no food is visible, use name "Unknown" and null for numeric fields.
        """

        let body: [String: Any] = [
            "contents": [[
                "parts": [
                    ["text": prompt],
                    ["inline_data": [
                        "mime_type": "image/jpeg",
                        "data": jpegData.base64EncodedString()
                    ]]
                ]
            ]]
        ]

        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            throw AnalyzerError.apiError((response as? HTTPURLResponse)?.statusCode ?? -1)
        }

        return try parseResponse(data)
    }

    private func parseResponse(_ data: Data) throws -> FoodAnalysisResult {
        guard
            let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
            let candidates = json["candidates"] as? [[String: Any]],
            let content = candidates.first?["content"] as? [String: Any],
            let parts = content["parts"] as? [[String: Any]],
            let text = parts.first?["text"] as? String
        else { throw AnalyzerError.invalidResponse }

        // Strip markdown fences if model wraps JSON anyway
        let cleaned = text
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "```json", with: "")
            .replacingOccurrences(of: "```", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        guard
            let foodData = cleaned.data(using: .utf8),
            let foodJson = try JSONSerialization.jsonObject(with: foodData) as? [String: Any]
        else { throw AnalyzerError.invalidResponse }

        return FoodAnalysisResult(
            name:        foodJson["name"]        as? String ?? "Unknown",
            kcal:        foodJson["kcal"]        as? Int,
            protein:     foodJson["protein_g"]   as? Double,
            carbs:       foodJson["carbs_g"]     as? Double,
            fat:         foodJson["fat_g"]       as? Double,
            description: foodJson["description"] as? String ?? ""
        )
    }

    enum AnalyzerError: LocalizedError {
        case imageEncodingFailed
        case apiError(Int)
        case invalidResponse

        var errorDescription: String? {
            switch self {
            case .imageEncodingFailed: return "Failed to encode image"
            case .apiError(let code): return "API error: HTTP \(code)"
            case .invalidResponse:    return "Could not parse API response"
            }
        }
    }
}

// MARK: - UIImage resize helper

private extension UIImage {
    func resized(maxSide: CGFloat) -> UIImage {
        let scale = min(maxSide / max(size.width, size.height), 1)
        guard scale < 1 else { return self }
        let newSize = CGSize(width: size.width * scale, height: size.height * scale)
        let renderer = UIGraphicsImageRenderer(size: newSize)
        return renderer.image { _ in draw(in: CGRect(origin: .zero, size: newSize)) }
    }
}

// MARK: - Secrets

enum Secrets {
    static var geminiAPIKey: String {
        guard
            let url  = Bundle.main.url(forResource: "Secrets", withExtension: "plist"),
            let dict = NSDictionary(contentsOf: url) as? [String: Any],
            let key  = dict["GEMINI_API_KEY"] as? String,
            key != "YOUR_API_KEY_HERE", !key.isEmpty
        else { return "" }
        return key
    }
}
