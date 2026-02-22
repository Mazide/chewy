//
//  AppState.swift
//  chewy
//

import Foundation
import SwiftUI
import Combine

@MainActor
final class AppState: ObservableObject {
    @Published var heroStatus: HeroStatus = .hungry
    @Published var mealLogs: [MealLog] = []
    @Published var isProcessing: Bool = false

    func feedHero(portionSize: Double) async {
        // Step 1: Mark as eating immediately
        heroStatus = .eating
        isProcessing = true

        // Step 2: Simulate 2-second AI analysis delay
        try? await Task.sleep(nanoseconds: 2_000_000_000)

        // Step 3: Add meal log and mark as happy
        let log = MealLog(portionSize: portionSize)
        mealLogs.insert(log, at: 0)
        heroStatus = .happy
        isProcessing = false

        // Step 4: Reset to hungry after 3 seconds
        try? await Task.sleep(nanoseconds: 3_000_000_000)
        if heroStatus == .happy {
            heroStatus = .hungry
        }
    }
}
