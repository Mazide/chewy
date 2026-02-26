//
//  AppState.swift
//  chewy
//

import Foundation
import SwiftUI
internal import Combine

@MainActor
final class AppState: ObservableObject {
    @Published var heroStatus: HeroStatus = .idle
    @Published var analysisResult: FoodAnalysisResult?
    @Published var isAnalyzing = false

    let analyzer: any FoodAnalyzerService

    init(analyzer: (any FoodAnalyzerService)? = nil) {
        if let analyzer {
            self.analyzer = analyzer
        } else {
            let key = Secrets.geminiAPIKey
            self.analyzer = key.isEmpty ? MockFoodAnalyzer() : GeminiFoodAnalyzer(apiKey: key)
        }
    }

    func didAddFood(image: UIImage) async {
        isAnalyzing = true
        heroStatus = .eating

        do {
            analysisResult = try await analyzer.analyze(image: image)
        } catch {
            print("Food analysis error:", error.localizedDescription)
        }

        isAnalyzing = false
        heroStatus = .happy

        try? await Task.sleep(for: .seconds(3))
        if heroStatus == .happy { heroStatus = .idle }
    }
}
