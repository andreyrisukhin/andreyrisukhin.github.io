use bevy::prelude::*;
use wasm_bindgen::prelude::*;

const PLAYER_SPEED: f32 = 320.0;

#[derive(Component)]
struct Player;

#[wasm_bindgen(start)]
pub fn start() {
    App::new()
        .insert_resource(ClearColor(Color::rgb(0.08, 0.08, 0.1)))
        .add_plugins(DefaultPlugins.set(WindowPlugin {
            primary_window: Some(Window {
                title: "Golem Demo".to_string(),
                canvas: Some("#golem-canvas".to_string()),
                fit_canvas_to_parent: true,
                prevent_default_event_handling: true,
                ..default()
            }),
            ..default()
        }))
        .add_systems(Startup, setup)
        .add_systems(Update, player_movement)
        .run();
}

fn setup(mut commands: Commands) {
    commands.spawn(Camera2dBundle::default());
    commands.spawn(SpriteBundle {
        sprite: Sprite {
            color: Color::rgb(0.2, 0.7, 0.9),
            custom_size: Some(Vec2::new(220.0, 220.0)),
            ..default()
        },
        ..default()
    })
    .insert(Player);
}

fn player_movement(
    keyboard: Res<Input<KeyCode>>,
    time: Res<Time>,
    mut query: Query<&mut Transform, With<Player>>,
) {
    let mut direction = 0.0;
    if keyboard.pressed(KeyCode::A) {
        direction -= 1.0;
    }
    if keyboard.pressed(KeyCode::D) {
        direction += 1.0;
    }

    if direction != 0.0 {
        let delta = direction * PLAYER_SPEED * time.delta_seconds();
        for mut transform in &mut query {
            transform.translation.x += delta;
        }
    }
}
