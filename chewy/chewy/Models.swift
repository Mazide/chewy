//
//  Models.swift
//  chewy
//

import Foundation

// MARK: - Hero Status

enum HeroStatus: String {
    case hungry = "Hungry"
    case eating = "Eating"
    case happy = "Happy"
}

// MARK: - Meal Log

struct MealLog: Identifiable {
    let id: UUID
    let timestamp: Date
    let portionSize: Double  // 0–100
    let emoji: String

    init(portionSize: Double) {
        self.id = UUID()
        self.timestamp = Date()
        self.portionSize = portionSize
        self.emoji = MealLog.randomFoodEmoji()
    }

    private static func randomFoodEmoji() -> String {
        let emojis = ["🍖", "🥩", "🥦", "🥕", "🍎", "🍗", "🥗", "🌮", "🍕", "🥚"]
        return emojis.randomElement() ?? "🍽️"
    }

    var portionLabel: String {
        switch portionSize {
        case 0..<34: return "Small"
        case 34..<67: return "Medium"
        default: return "Large"
        }
    }

    var formattedTime: String {
        let f = DateFormatter()
        f.timeStyle = .short
        return f.string(from: timestamp)
    }
}
