const fs = require("fs-extra");
const path = require("path");
const _ = require("lodash");

const writeToStorage = (data) => {
  if (!data || _.isObject(data)) return;

  const pathToStorage = path.resolve(__dirname, "../../storage/");
  let existingData;

  fs.ensureDirSync(pathToStorage);

  if (fs.existsSync(path.resolve(pathToStorage, "local-storage.json"))) {
    const existingFile = fs.readFileSync(
      path.resolve(pathToStorage, "local-storage.json"),
    );
    existingData = JSON.parse(existingFile);
  }

  const existingDataBackup = existingData;

  try {
    const workingData = existingData ? existingData : [];
    if (_.isArray(workingData)) {
      const idMap = workingData.map((obj) => obj.id);
      let maxIdx;
      if (!_.isEmpty(idMap)) {
        maxIdx = Math.max(...idMap);
      }
      data.id = maxIdx ? maxIdx + 1 : 1;
      workingData.push(data);
    }
    fs.writeFileSync(
      path.resolve(pathToStorage, "local-storage.json"),
      workingData,
    );
  } catch (err) {
    console.error(
      `Error at writing newer data to the local storage, the older data will be recovered: ${err}`,
    );
    fs.writeFileSync(
      path.resolve(pathToStorage, "local-storage.json"),
      existingDataBackup,
    );
  }
};

const retrieveFromStorageByDate = () => { };

const retrieveAllFromStorage = () => { };

const retrieveFromStorageByIndex = () => { };

module.exports = {
  writeToStorage,
  retrieveFromStorageByDate,
  retrieveAllFromStorage,
  retrieveFromStorageByIndex,
};
