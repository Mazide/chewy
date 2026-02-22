//
//  HomeView.swift
//  chewy
//

import SwiftUI

struct HomeView: View {
    @EnvironmentObject var appState: AppState
    @State private var showAddFood = false
    @State private var buttonPressed = false

    var body: some View {
        ZStack(alignment: .bottom) {
            BackgroundSpriteView()

            VStack {
                Spacer()
                HeroView(status: appState.heroStatus)
                    .animation(.easeInOut(duration: 0.4), value: appState.heroStatus)
                Spacer()
                Color.clear.frame(height: 120)
            }

            // Add Food button
            Button {
                showAddFood = true
            } label: {
                Image("add_meal_icon")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 80, height: 80)
                    .shadow(color: .black.opacity(0.35), radius: 12, x: 0, y: 6)
                    .shadow(color: .black.opacity(0.15), radius: 4, x: 0, y: 2)
                    .scaleEffect(buttonPressed ? 0.88 : 1.0)
            }
            .buttonStyle(.plain)
            .simultaneousGesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { _ in
                        withAnimation(.easeInOut(duration: 0.1)) { buttonPressed = true }
                    }
                    .onEnded { _ in
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.5)) { buttonPressed = false }
                    }
            )
            .padding(.bottom, 52)
        }
        .ignoresSafeArea()
        .sheet(isPresented: $showAddFood) {
            AddFoodView()
                .environmentObject(appState)
        }
    }
}

#Preview {
    HomeView()
        .environmentObject(AppState())
}
