//
//  HomeView.swift
//  chewy
//

import SwiftUI

struct HomeView: View {
    @EnvironmentObject var appState: AppState
    @State private var showAddFood = false

    var body: some View {
        ZStack(alignment: .bottom) {
            // Background gradient
            LinearGradient(
                colors: [Color(red: 0.54, green: 0.86, blue: 0.54), Color(red: 0.2, green: 0.6, blue: 0.3)],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            // Main scroll content
            ScrollView {
                VStack(spacing: 0) {
                    // Top bar
                    HStack {
                        Text("chewy")
                            .font(.system(size: 28, weight: .black, design: .rounded))
                            .foregroundColor(.white)
                        Spacer()
                        Image(systemName: "cart.fill")
                            .font(.title2)
                            .foregroundColor(.white)
                            .padding(8)
                            .background(Color.white.opacity(0.25))
                            .clipShape(Circle())
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 8)
                    .padding(.bottom, 16)

                    // Hero Widget
                    HeroView(status: appState.heroStatus)
                        .frame(height: 280)
                        .padding(.horizontal, 24)
                        .animation(.easeInOut(duration: 0.4), value: appState.heroStatus)

                    // Meal Log section
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Recent Meals")
                            .font(.system(size: 16, weight: .bold, design: .rounded))
                            .foregroundColor(.white.opacity(0.9))
                            .padding(.horizontal, 20)
                            .padding(.top, 24)

                        if appState.mealLogs.isEmpty {
                            Text("No meals yet — feed your hero!")
                                .font(.system(size: 14, design: .rounded))
                                .foregroundColor(.white.opacity(0.7))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 20)
                        } else {
                            VStack(spacing: 8) {
                                ForEach(appState.mealLogs.prefix(5)) { log in
                                    MealLogRow(log: log)
                                }
                            }
                            .padding(.horizontal, 16)
                        }
                    }
                    // Отступ снизу — чтобы контент не прятался за FAB
                    .padding(.bottom, 100)
                }
            }

            // FAB — всегда видна внизу поверх всего
            Button {
                showAddFood = true
            } label: {
                HStack(spacing: 10) {
                    Image(systemName: "camera.fill")
                        .font(.system(size: 18, weight: .bold))
                    Text("Add Food")
                        .font(.system(size: 18, weight: .bold, design: .rounded))
                }
                .foregroundColor(.white)
                .padding(.horizontal, 40)
                .padding(.vertical, 18)
                .background(
                    LinearGradient(
                        colors: [Color(red: 1.0, green: 0.55, blue: 0.1), Color(red: 0.9, green: 0.3, blue: 0.1)],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .clipShape(Capsule())
                .shadow(color: Color(red: 0.9, green: 0.3, blue: 0.1).opacity(0.5), radius: 12, x: 0, y: 6)
            }
            .padding(.bottom, 36)
        }
        .fullScreenCover(isPresented: $showAddFood) {
            AddFoodView()
                .environmentObject(appState)
        }
    }
}

// MARK: - Meal Log Row

struct MealLogRow: View {
    let log: MealLog

    var body: some View {
        HStack(spacing: 12) {
            Text(log.emoji)
                .font(.system(size: 28))
                .frame(width: 44, height: 44)
                .background(Color.white.opacity(0.2))
                .clipShape(RoundedRectangle(cornerRadius: 10))

            VStack(alignment: .leading, spacing: 2) {
                Text("\(log.portionLabel) portion")
                    .font(.system(size: 14, weight: .semibold, design: .rounded))
                    .foregroundColor(.white)
                Text(log.formattedTime)
                    .font(.system(size: 12, design: .rounded))
                    .foregroundColor(.white.opacity(0.7))
            }

            Spacer()

            // Portion bar
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(Int(log.portionSize))%")
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .foregroundColor(.white)
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 3)
                            .fill(Color.white.opacity(0.2))
                        RoundedRectangle(cornerRadius: 3)
                            .fill(Color.white.opacity(0.8))
                            .frame(width: geo.size.width * log.portionSize / 100)
                    }
                }
                .frame(width: 60, height: 6)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(Color.white.opacity(0.12))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}

#Preview {
    HomeView()
        .environmentObject(AppState())
}
