import fs from "fs";
import path from "path";
import {
  DEFAULT_BUCKET_STORAGE_CLASS,
  DEFAULT_BUCKET_LOCATION
} from "./constants";
import { Storage as BaseStorage, Bucket } from "@google-cloud/storage";

class Storage {
  async createDirectory(name: string, bucket: Bucket) {
    // create dummy directory, deployments
    const dirExist = fs.existsSync(name);
    if (dirExist) {
      // if dir exist then remove it
      await fs.promises.rmdir(name, { recursive: true });
    }
    // create dir
    await fs.promises.mkdir(name);
    let dirPath = path.resolve(__dirname, `./${name}`);
    let filePath = path.resolve(dirPath, `./README.md`);
    // create new files under dir, we can't create directory , so we need to upload empty file so it will automatically create directory in bucket
    await fs.promises.writeFile(filePath, "");
    // upload directory in bucket
    await bucket.upload(filePath, {
      destination: `${name}/README.md`
    });
    // remove local directory
    await fs.promises.rmdir(name, { recursive: true });
  }

  async createBucket(
    bucketName,
    location = DEFAULT_BUCKET_LOCATION,
    storageClass = DEFAULT_BUCKET_STORAGE_CLASS
  ) {
    // Creates a new bucket in the Asia region with the coldline default storage
    // class. Leave the second argument blank for default settings.
    //
    // For default values see: https://cloud.google.com/storage/docs/locations and
    // https://cloud.google.com/storage/docs/storage-classes

    const storage = new BaseStorage();

    let bucket = storage.bucket(bucketName, {});
    const [bucketExist] = await bucket.exists();

    if (!bucketExist) {
      // if bucket doesn't exist then create new bucket
      [bucket] = await storage.createBucket(bucketName, {
        location,
        standard: true
      });
    }

    // Create two directories under bucket
    // 1. deployments
    // 2. Attachments
    // create deployments directory & upload it
    await this.createDirectory("deployments", bucket);
    // create attachments directory & upload it
    await this.createDirectory("attachments", bucket);

    return { id: bucket.id, name: bucket.name };
  }
}

export default new Storage();
