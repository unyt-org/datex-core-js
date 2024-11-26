const [type] = Deno.args;

const ghOutput = Deno.env.get("GITHUB_OUTPUT")!;
if (!ghOutput) {
    throw new Error("Can not find GITHUB_OUTPUT environment variable");
}

if (!["major", "minor", "patch"].includes(type)) {
    throw new Error(
        "Invalid version bump type. Use 'major', 'minor', or 'patch'.",
    );
}

const cargoTomlPath = "./rs-lib/Cargo.toml";
const cargoToml = await Deno.readTextFile(cargoTomlPath);

const denoJsonPath = "./deno.json";
const denoJsonText = await Deno.readTextFile(denoJsonPath);
const denoJson = JSON.parse(denoJsonText);


// Extract versions from Cargo.toml and deno.json
const cargoVersionRegex = /version\s*=\s*"(\d+)\.(\d+)\.(\d+)"/;
const denoVersionRegex = /"version":\s*"(\d+\.\d+\.\d+)"/;

const match = cargoVersionRegex.exec(cargoToml);
if (!match) {
    throw new Error("Version not found in Cargo.toml");
}
let [major, minor, patch] = match.slice(1).map(Number);
const cargoVersion = `${major}.${minor}.${patch}`;

const denoVersion = denoJson.version;
if (!denoVersion) {
    throw new Error("Version not found in deno.json");
}

// check if versions match
if (denoVersion !== cargoVersion) {
    throw new Error("Version mismatch between Cargo.toml and deno.json");
}


switch (type) {
    case "major":
        major++;
        minor = 0;
        patch = 0;
        break;
    case "minor":
        minor++;
        patch = 0;
        break;
    case "patch":
        patch++;
        break;
}

const newVersion = `${major}.${minor}.${patch}`;

// update Cargo.toml
const updatedCargoToml = cargoToml.replace(
    cargoVersionRegex,
    `version = "${newVersion}"`,
);
await Deno.writeTextFile(cargoTomlPath, updatedCargoToml);

// update deno.json
const updatedDenoJson = denoJsonText.replace(
    denoVersionRegex,
    `"version": "${newVersion}"`,
);
await Deno.writeTextFile(denoJsonPath, updatedDenoJson);

// pass new version to the next step
await Deno.writeTextFile(ghOutput, `NEW_VERSION=${newVersion}`, { append: true });

console.log(`Version updated to ${newVersion}`, ghOutput);