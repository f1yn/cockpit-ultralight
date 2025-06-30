#!/usr/bin/env bash

# Podman makes this pretty easy. We will simply spin up concurrent containerized environments that will take
# our compiled sources, and wrap them into our distributable packages.

# The cacth? This is the only place variables should be described. And they should be done so through the environment
# See the VAIRABLES BELOW #

set -e

### VARIABLES BELOW: ###

# Set this to the name of your project
PROJECT_NAME="cockpit-ultralight"

### INTERNALS BELOW: ###

current_dir="$(dirname -- "$0")"

function generate_image_name() {
    local target="$1";
    echo "$PROJECT_NAME-$target:latest"
}

function create_dist_builder() (
    target="$1"
    image_name="$(generate_image_name "$target")"

    build_image_args=(
        "--tag $image_name"
        "--file $current_dir/packaging/$target.containerfile"
    )

    # We want the globbing here, so ignotre
    # shellcheck disable=SC2068
    podman build ${build_image_args[@]};
)

function create_dist() (
    target="$1"
    # Execute the document container
)

### START SCRIPT: ###

echo "STEP 1 - Building plugin"
# npm run build
echo "STEP 1 - Complete"

echo "STEP 2 - Create images for building"
create_dist_builder "rpm" &
wait;
echo "STEP 2 - Complete"