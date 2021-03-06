import path from 'path';
import fs from 'fs';
import shell from 'shelljs';
import { executeAsync, execShellAsync, execCLI } from '../exec';
import {
    isPlatformSupported, getConfig, logTask, logComplete, logError,
    getAppFolder, isPlatformActive, configureIfRequired,
    CLI_ANDROID_EMULATOR, CLI_ANDROID_ADB, CLI_TIZEN_EMULATOR, CLI_TIZEN, CLI_WEBOS_ARES,
    CLI_WEBOS_ARES_PACKAGE, CLI_WEBBOS_ARES_INSTALL, CLI_WEBBOS_ARES_LAUNCH,
} from '../common';
import { cleanFolder, copyFolderContentsRecursiveSync, copyFolderRecursiveSync, copyFileSync, mkdirSync } from '../fileutils';


function launchAndroidSimulator(c, name) {
    logTask('launchAndroidSimulator');

    if (name) {
        return execCLI(c, CLI_ANDROID_EMULATOR, `-avd "${name}"`);
    }
    return Promise.reject('No simulator -t target name specified!');
}

function listAndroidTargets(c) {
    logTask('listAndroidTargets');

    return execCLI(c, CLI_ANDROID_ADB, 'devices -l');
}


const copyAndroidAssets = (c, platform) => new Promise((resolve, reject) => {
    logTask('copyAndroidAssets');
    if (!isPlatformActive(c, platform, resolve)) return;

    const destPath = path.join(getAppFolder(c, platform), 'app/src/main/res');
    const sourcePath = path.join(c.appConfigFolder, `assets/${platform}/res`);
    copyFolderContentsRecursiveSync(sourcePath, destPath);
    resolve();
});

const packageAndroid = (c, platform) => new Promise((resolve, reject) => {
    logTask('packageAndroid');

    const appFolder = getAppFolder(c, platform);
    executeAsync('react-native', [
        'bundle',
        '--platform',
        'android',
        '--dev',
        'false',
        '--assets-dest',
        `${appFolder}/app/src/main/res`,
        '--entry-file',
        `${c.appConfigFile.platforms[platform].entryFile}.js`,
        '--bundle-output',
        `${appFolder}/app/src/main/assets/index.android.bundle`,
    ]).then(() => resolve()).catch(e => reject(e));
});

const runAndroid = (c, platform) => new Promise((resolve, reject) => {
    logTask('runAndroid');

    const appFolder = getAppFolder(c, platform);

    shell.cd(`${appFolder}`);
    shell.exec('./gradlew appStart', resolve, reject);
});

const configureAndroidProperties = c => new Promise((resolve, reject) => {
    logTask('configureAndroidProperties');

    const localProperties = path.join(c.globalConfigFolder, 'local.properties');
    if (fs.existsSync(localProperties)) {
        console.log('local.properties file exists!');
    } else {
        console.log('local.properties file missing! Creating one for you...');
    }

    fs.writeFileSync(localProperties, `#Generated by RNV
ndk.dir=${c.globalConfig.sdks.ANDROID_NDK}
sdk.dir=${c.globalConfig.sdks.ANDROID_SDK}`);

    resolve();
});

const configureGradleProject = (c, platform) => new Promise((resolve, reject) => {
    logTask('configureGradleProject');

    if (!isPlatformActive(c, platform, resolve)) return;

    configureIfRequired(c, platform)
        .then(() => configureAndroidProperties(c, platform))
        .then(() => copyAndroidAssets(c, platform))
        .then(() => configureProject(c, platform))
        .then(() => resolve())
        .catch(e => reject(e));
});

const configureProject = (c, platform) => new Promise((resolve, reject) => {
    logTask(`configureProject:${platform}`);

    const appFolder = getAppFolder(c, platform);

    copyFileSync(path.join(c.globalConfigFolder, 'local.properties'), path.join(appFolder, 'local.properties'));
    mkdirSync(path.join(appFolder, 'app/src/main/assets'));
    fs.writeFileSync(path.join(appFolder, 'app/src/main/assets/index.android.bundle'), '{}');
    fs.chmodSync(path.join(appFolder, 'gradlew'), '755');

    resolve();
});

export {
    copyAndroidAssets, configureGradleProject, launchAndroidSimulator,
    listAndroidTargets, packageAndroid, runAndroid, configureAndroidProperties,
};
