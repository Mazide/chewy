//
//  SpriteKitHeroView.swift
//  chewy
//

import SwiftUI
import SpriteKit

// MARK: - SwiftUI wrapper

struct SpriteKitHeroView: View {
    let status: HeroStatus

    // Scene stored in @State so it's never recreated on re-render
    // Size = native @2x asset size (506×1060px) → displayed at 253×530pt
    @State private var scene: HeroScene = {
        let s = HeroScene(size: CGSize(width: 506, height: 1060))
        s.backgroundColor = .clear
        s.scaleMode = .resizeFill
        return s
    }()

    var body: some View {
        SpriteView(scene: scene, options: [.allowsTransparency])
            .frame(width: 253, height: 530)   // pt = px / 2 (@2x)
            .onChange(of: status) { _, newStatus in
                scene.heroStatus = newStatus
            }
    }
}

// MARK: - SKScene

final class HeroScene: SKScene {

    private static let framePrefix = "idle_"
    private static let frameCount  = 121
    private static let fps: Double = 24

    var heroStatus: HeroStatus = .idle {
        didSet { guard oldValue != heroStatus else { return }; updateAnimation() }
    }

    private var spriteNode: SKSpriteNode?
    private var allTextures: [SKTexture] = []

    // MARK: - Lifecycle

    override func didMove(to view: SKView) {
        backgroundColor = .clear
        loadTextures()
        setupSprite()
        updateAnimation()
    }

    // MARK: - Setup

    private func loadTextures() {
        let atlas = SKTextureAtlas(named: "hero")
        allTextures = (0..<Self.frameCount).map { i in
            let name = String(format: "\(Self.framePrefix)%03d", i)
            let tex = atlas.textureNamed(name)
            tex.filteringMode = .linear
            return tex
        }
    }

    private func setupSprite() {
        guard let first = allTextures.first else { return }
        let node = SKSpriteNode(texture: first)
        // Fix the node size to the scene canvas so SKAction.animate
        // never resizes it when switching textures (prevents jitter).
        node.size = size
        node.position = CGPoint(x: size.width / 2, y: size.height / 2)
        addChild(node)
        spriteNode = node
    }

    // MARK: - Animation

    private func updateAnimation() {
        spriteNode?.removeAllActions()

        switch heroStatus {
        case .idle:
            playLoop(textures: allTextures, fps: Self.fps)

        case .eating:
            playLoop(textures: allTextures, fps: Self.fps * 0.6)
            let pulse = SKAction.sequence([
                SKAction.scale(by: 1.06, duration: 0.5),
                SKAction.scale(by: 1 / 1.06, duration: 0.5)
            ])
            spriteNode?.run(SKAction.repeatForever(pulse), withKey: "pulse")

        case .happy:
            let fast = SKAction.animate(with: allTextures, timePerFrame: 1.0 / (Self.fps * 1.5), resize: false, restore: false)
            let hold = SKAction.setTexture(allTextures.last!, resize: false)
            spriteNode?.run(SKAction.sequence([fast, hold]))
        }
    }

    private func playLoop(textures: [SKTexture], fps: Double) {
        // resize: false — node size stays fixed, only texture swaps → no jitter
        let anim = SKAction.animate(with: textures, timePerFrame: 1.0 / fps, resize: false, restore: false)
        spriteNode?.run(SKAction.repeatForever(anim), withKey: "anim")
    }
}
