use bevy::prelude::*;
use bevy_rapier2d::prelude::*;

use crate::constants::TILE_SIZE;
use crate::level::Level;
use crate::player::spawn_player;

const WALL_COLOR: Color = Color::rgb(0.18, 0.2, 0.24);

#[derive(Component)]
struct Wall;

pub struct LevelChanged;

pub fn setup_scene(mut commands: Commands, level: Res<Level>) {
    commands.spawn(Camera2dBundle::default());
    spawn_level(&mut commands, &level);
    spawn_player(&mut commands);
}

pub fn apply_level_changes(
    mut commands: Commands,
    mut events: EventReader<LevelChanged>,
    level: Res<Level>,
    walls: Query<Entity, With<Wall>>,
) {
    if events.is_empty() {
        return;
    }
    events.clear();
    for entity in walls.iter() {
        commands.entity(entity).despawn();
    }
    spawn_level(&mut commands, &level);
}

fn spawn_level(commands: &mut Commands, level: &Level) {
    spawn_border(commands, level);
    spawn_walls(commands, level);
}

fn spawn_border(commands: &mut Commands, level: &Level) {
    let (min, max) = level.world_bounds();
    let thickness = TILE_SIZE;
    let horizontal = Vec2::new(max.x - min.x + thickness * 2.0, thickness);
    let vertical = Vec2::new(thickness, max.y - min.y + thickness * 2.0);

    let top = Vec2::new(0.0, max.y + thickness * 0.5);
    let bottom = Vec2::new(0.0, min.y - thickness * 0.5);
    let left = Vec2::new(min.x - thickness * 0.5, 0.0);
    let right = Vec2::new(max.x + thickness * 0.5, 0.0);

    spawn_wall_collider(commands, top, horizontal);
    spawn_wall_collider(commands, bottom, horizontal);
    spawn_wall_collider(commands, left, vertical);
    spawn_wall_collider(commands, right, vertical);
}

fn spawn_walls(commands: &mut Commands, level: &Level) {
    for y in 0..level.height {
        for x in 0..level.width {
            if !level.is_wall(x, y) {
                continue;
            }
            let center = level.tile_center(IVec2::new(x, y));
            commands
                .spawn((
                    SpriteBundle {
                        sprite: Sprite {
                            color: WALL_COLOR,
                            custom_size: Some(Vec2::splat(TILE_SIZE)),
                            ..default()
                        },
                        transform: Transform::from_xyz(center.x, center.y, 0.0),
                        ..default()
                    },
                    Wall,
                    RigidBody::Fixed,
                    Collider::cuboid(TILE_SIZE * 0.5, TILE_SIZE * 0.5),
                ));
        }
    }
}

fn spawn_wall_collider(commands: &mut Commands, center: Vec2, size: Vec2) {
    commands.spawn((
        Wall,
        RigidBody::Fixed,
        Collider::cuboid(size.x * 0.5, size.y * 0.5),
        TransformBundle::from_transform(Transform::from_xyz(center.x, center.y, 0.0)),
    ));
}
