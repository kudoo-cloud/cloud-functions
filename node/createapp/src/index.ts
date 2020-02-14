import express from "express";
import storage from "./helpers/storageBucket";
import gitea, {
  CreateUser,
  CreateOrganization,
  CreateTeam
} from "./helpers/gitea";

const app = express();

app.post("/main", async (req, res) => {});

app.post("/setup/storage", async (req, res) => {
  try {
    const bucketName = req.body ? req.body.bucketName : "";
    if (bucketName) {
      const bucketRes = await storage.createBucket(bucketName);
      res.send(bucketRes);
    } else {
      res.status(422).send({ error: "bucketName field is required" });
    }
  } catch (error) {
    res.status(500).send({ error });
  }
});

/**
 * Gitea Api
 */

app.post("/setup/gitea/user", async (req, res) => {
  try {
    const { username, email, first_name, last_name } = req.body;
    const user = await gitea.createUser({
      email,
      first_name,
      last_name,
      username
    });
    res.status(200).send({ ...user });
  } catch (error) {
    res.status(500).send(error);
  }
});

app.post("/setup/gitea/organization", async (req, res) => {
  try {
    const { description, full_name, location, website, owner } = req.body;
    const organization = await gitea.createOrganization({
      description,
      full_name,
      location,
      website,
      owner
    });
    res.status(200).send({ ...organization });
  } catch (error) {
    res.status(500).send(error);
  }
});

app.post("/setup/gitea/team", async (req, res) => {
  try {
    const { description, name, orgId } = req.body;
    const team = await gitea.createTeam({
      description,
      name,
      orgId
    });
    res.status(200).send({ ...team });
  } catch (error) {
    res.status(500).send(error);
  }
});

app.post("/setup/gitea/team/add-member", async (req, res) => {
  try {
    const { teamId, userId } = req.body;
    await gitea.addTeamMemeber({ teamId, userId });
    await gitea.addTeamMemeber({ teamId, userId: process.env.KUDOO_BOT });
    res.status(200).send({ status: "success" });
  } catch (error) {
    res.status(500).send(error);
  }
});

app.post("/setup/gitea/fork-repo", async (req, res) => {
  try {
    const { orgId, repoOwner, repoName } = req.body;
    await gitea.forkRepo({ orgId, repoName, repoOwner });
    res.status(200).send({ status: "success" });
  } catch (error) {
    res.status(500).send(error);
  }
});

app.post("/setup/gitea/full", async (req, res) => {
  try {
    const { user, organization, team } = req.body;
    // create user
    const createdUser = await gitea.createUser(user as CreateUser);
    // create organization
    const createdOrg = await gitea.createOrganization({
      ...organization,
      owner: createdUser.username
    } as CreateOrganization);
    // create team
    const createdTeam = await gitea.createTeam({
      name: team.name,
      description: team.description,
      orgId: createdOrg.username
    } as CreateTeam);
    // add user and kudoo-bot as a team member
    await gitea.addTeamMemeber({
      teamId: createdTeam.id,
      userId: createdUser.username
    });
    await gitea.addTeamMemeber({
      teamId: createdTeam.id,
      userId: process.env.KUDOO_BOT
    });
    // fork repo
    res.status(200).send({ createdOrg, createdUser, createdTeam });
  } catch (error) {
    res.status(500).send(error);
  }
});

exports.main = app;
