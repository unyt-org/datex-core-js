const watchDirs = [
    "./src",
    "./rs-lib"
];

let serverProcess: Deno.ChildProcess | null = null;
let buildTimer: number | undefined;
let building = false;
let pending = false;

async function runBuild() {
    console.log("Running build:npm...");

    const cmd = new Deno.Command("deno", {
        args: ["task", "build:npm", "--dev"],
        stdout: "inherit",
        stderr: "inherit",
    });

    const result = await cmd.output();

    if (!result.success) {
        throw new Error("build:npm failed");
    }

    console.log("Build complete");
}

function startServer() {
    console.log("Starting npm server...");

    serverProcess = new Deno.Command("npm", {
        args: ["run", "serve"],
        cwd: "./npm",
        stdout: "inherit",
        stderr: "inherit",
    }).spawn();

    const url = encodeURIComponent("https://localhost:3489/esm/mod.js");
    setTimeout(() => {
        console.log("\n============================================================================================================================")
        console.log(" Current DATEX build is available at https://workbench.unyt.org/enable-local-patch?url=" + url);
        console.log("============================================================================================================================")
    }, 1000);
}

async function stopServer() {
    if (!serverProcess) return;

    console.log("Stopping npm server...");

    serverProcess.kill("SIGTERM");
    await serverProcess.status;

    serverProcess = null;
}

async function restartServer() {
    await stopServer();
    await runBuild();
    startServer();
}

async function scheduleRestart() {
    if (building) {
        pending = true;
        return;
    }

    building = true;

    try {
        await restartServer();
    } finally {
        building = false;

        if (pending) {
            pending = false;
            scheduleRestart();
        }
    }
}

function debounceRestart() {
    if (buildTimer) {
        clearTimeout(buildTimer);
    }

    buildTimer = setTimeout(() => {
        scheduleRestart();
    }, 500);
}

// Initial startup
await runBuild();
await startServer();

// Watch changes
for await (const event of Deno.watchFs(watchDirs)) {
    if (
        event.kind === "modify" ||
        event.kind === "create" ||
        event.kind === "remove"
    ) {
        debounceRestart();
    }
}

// Cleanup
addEventListener("unload", async () => {
    await stopServer();
});