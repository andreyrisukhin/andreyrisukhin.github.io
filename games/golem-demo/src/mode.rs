use bevy::prelude::*;

#[derive(Resource, Copy, Clone, Eq, PartialEq)]
pub enum GameMode {
    Edit,
    Play,
}

pub fn toggle_mode(keyboard: Res<ButtonInput<KeyCode>>, mut mode: ResMut<GameMode>) {
    if keyboard.just_pressed(KeyCode::Tab) {
        *mode = match *mode {
            GameMode::Edit => GameMode::Play,
            GameMode::Play => GameMode::Edit,
        };
    }
}

pub fn is_edit_mode(mode: Res<GameMode>) -> bool {
    matches!(*mode, GameMode::Edit)
}

pub fn is_play_mode(mode: Res<GameMode>) -> bool {
    matches!(*mode, GameMode::Play)
}
