//
//  SpriteKitHeroView.swift
//  chewy
//
//  SpriteKit animation backed by hero.spriteatlas in Assets.xcassets.
//  Drop-in replacement for the placeholder HeroSpriteView.
//

import SwiftUI
import SpriteKit

// MARK: - SwiftUI wrapper

struct SpriteKitHeroView: View {
    let status: HeroStatus

    var body: some View {
        GeometryReader { geo in
            SpriteView(scene: makeScene(size: geo.size), options: [.allowsTransparency])
                .frame(width: geo.size.width, height: geo.size.height)
        }
        .aspectRatio(1, contentMode: .fit)
        .frame(width: 180, height: 180)
    }

    private func makeScene(size: CGSize) -> HeroScene {
        let scene = HeroScene(size: size)
        scene.backgroundColor = .clear
        scene.scaleMode = .aspectFit
        scene.heroStatus = status
        return scene
    }
}

// MARK: - SKScene

final class HeroScene: SKScene {

    // Atlas frame name prefix — matches the PNG filenames inside hero.spriteatlas
    // (without .png extension, as SpriteKit strips it)
    private static let framePrefix = "idle_"
    private static let frameCount  = 121
    private static let fps: Double = 24

    var heroStatus: HeroStatus = .hungry {
        didSet { guard oldValue != heroStatus else { return }; updateAnimation() }
    }

    private var spriteNode: SKSpriteNode!
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
        spriteNode = SKSpriteNode(texture: first)
        // Fill the scene, keeping aspect ratio
        let scale = min(size.width / spriteNode.size.width,
                        size.height / spriteNode.size.height)
        spriteNode.setScale(scale)
        spriteNode.position = CGPoint(x: size.width / 2, y: size.height / 2)
        addChild(spriteNode)
    }

    // MARK: - Animation

    private func updateAnimation() {
        spriteNode?.removeAllActions()

        switch heroStatus {
        case .hungry:
            // Idle: play full loop at normal speed
            playLoop(textures: allTextures, fps: Self.fps)

        case .eating:
            // Eating: slow loop + gentle pulse
            playLoop(textures: allTextures, fps: Self.fps * 0.6)
            let pulse = SKAction.sequence([
                SKAction.scale(by: 1.06, duration: 0.5),
                SKAction.scale(by: 1 / 1.06, duration: 0.5)
            ])
            spriteNode.run(SKAction.repeatForever(pulse), withKey: "pulse")

        case .happy:
            // Happy: fast playthrough then hold last frame
            let fast = SKAction.animate(with: allTextures, timePerFrame: 1.0 / (Self.fps * 1.5))
            let hold = SKAction.setTexture(allTextures.last!)
            spriteNode.run(SKAction.sequence([fast, hold]))
        }
    }

    private func playLoop(textures: [SKTexture], fps: Double) {
        let anim = SKAction.animate(with: textures, timePerFrame: 1.0 / fps)
        spriteNode.run(SKAction.repeatForever(anim), withKey: "anim")
    }
}
