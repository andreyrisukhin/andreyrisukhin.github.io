use bevy::prelude::*;
use bevy_rapier2d::prelude::*;

const PLAYER_SIZE: Vec2 = Vec2::new(22.0, 22.0);
const PLAYER_SPEED: f32 = 160.0;

#[derive(Component)]
pub struct Player;

pub fn spawn_player(commands: &mut Commands) {
    commands.spawn((
        SpriteBundle {
            sprite: Sprite {
                color: Color::rgb(0.2, 0.7, 0.9),
                custom_size: Some(PLAYER_SIZE),
                ..default()
            },
            transform: Transform::from_xyz(0.0, 0.0, 1.0),
            ..default()
        },
        Player,
        RigidBody::KinematicPositionBased,
        Collider::cuboid(PLAYER_SIZE.x * 0.5, PLAYER_SIZE.y * 0.5),
        KinematicCharacterController::default(),
    ));
}

pub fn player_movement(
    keyboard: Res<ButtonInput<KeyCode>>,
    time: Res<Time>,
    mut controllers: Query<&mut KinematicCharacterController, With<Player>>,
) {
    let mut axis = Vec2::ZERO;
    if keyboard.pressed(KeyCode::A) {
        axis.x -= 1.0;
    }
    if keyboard.pressed(KeyCode::D) {
        axis.x += 1.0;
    }
    if keyboard.pressed(KeyCode::W) {
        axis.y += 1.0;
    }
    if keyboard.pressed(KeyCode::S) {
        axis.y -= 1.0;
    }

    if axis.length_squared() == 0.0 {
        return;
    }

    let delta = axis.normalize_or_zero() * PLAYER_SPEED * time.delta_seconds();
    for mut controller in &mut controllers {
        controller.translation = Some(delta);
    }
}
