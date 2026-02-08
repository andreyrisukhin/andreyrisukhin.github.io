use bevy::prelude::*;
use bevy_rapier2d::prelude::*;
use wasm_bindgen::prelude::*;

mod constants;
mod editor;
mod level;
mod mode;
mod player;
mod world;

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
        .add_plugins((
            RapierPhysicsPlugin::<NoUserData>::pixels_per_meter(constants::PIXELS_PER_METER),
            RapierDebugRenderPlugin::default(),
        ))
        .insert_resource(level::Level::default())
        .insert_resource(mode::GameMode::Play)
        .add_event::<world::LevelChanged>()
        .add_systems(Startup, world::setup_scene)
        .add_systems(Update, mode::toggle_mode)
        .add_systems(Update, editor::export_level.run_if(mode::is_edit_mode))
        .add_systems(Update, editor::edit_level.run_if(mode::is_edit_mode))
        .add_systems(Update, world::apply_level_changes)
        .add_systems(Update, player::player_movement.run_if(mode::is_play_mode))
        .run();
}
