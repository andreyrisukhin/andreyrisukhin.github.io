use bevy::prelude::*;
use bevy::window::PrimaryWindow;

use crate::level::Level;
use crate::world::LevelChanged;

pub fn export_level(keyboard: Res<ButtonInput<KeyCode>>, level: Res<Level>) {
    if keyboard.just_pressed(KeyCode::E) {
        info!("Level export:\n{}", level.to_ascii());
    }
}

pub fn edit_level(
    buttons: Res<ButtonInput<MouseButton>>,
    windows: Query<&Window, With<PrimaryWindow>>,
    cameras: Query<(&Camera, &GlobalTransform)>,
    mut level: ResMut<Level>,
    mut level_changed: EventWriter<LevelChanged>,
) {
    if !buttons.just_pressed(MouseButton::Left) {
        return;
    }

    let window = match windows.get_single() {
        Ok(window) => window,
        Err(_) => return,
    };

    let cursor = match window.cursor_position() {
        Some(position) => position,
        None => return,
    };

    let (camera, camera_transform) = match cameras.get_single() {
        Ok(data) => data,
        Err(_) => return,
    };

    let world_pos = match camera.viewport_to_world_2d(camera_transform, cursor) {
        Some(position) => position,
        None => return,
    };

    let tile = level.world_to_tile(world_pos);
    level.toggle_wall_at(tile);
    level_changed.send(LevelChanged);
}
