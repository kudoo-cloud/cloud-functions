import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import PasswordGenerator from "generate-password";
import joi from "@hapi/joi";
import { RANDOM_NUMBER } from "./constants";

const GITEA_BASE_URL = "https://git.kudoo.io/api/v1/";

export type CreateUser = {
  email: string;
  first_name: string;
  last_name: string;
  username: string;
};

export type CreateOrganization = {
  description: string;
  full_name: string;
  location: string;
  website: string;
  owner: string;
};

export type CreateTeam = {
  // org id where we want to add team
  orgId: string;
  // team description
  description: string;
  // team name, alphanumeric,.,_,-
  name: string;
};

export type AddTeamMemeber = {
  // team id to add user
  teamId: string;
  // user id
  userId: string;
};

export type ForkRepo = {
  // owner of the repo to fork
  repoOwner: string;
  // repo name to fork
  repoName: string;
  // org id to which fork repo
  orgId: string;
};

class Gitea {
  axios: AxiosInstance;

  constructor() {
    this.axios = axios.create({
      baseURL: GITEA_BASE_URL,
      headers: {},
      timeout: 60000
    });
  }

  private async doApiCall(config: AxiosRequestConfig) {
    try {
      const res = await this.axios.request({
        headers: {
          ...config.headers,
          Authorization: `Bearer ${process.env.GITEA_ACCESS_TOKEN}`,
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        ...config
      });
      return res.data;
    } catch (error) {
      if (error.response) {
        throw error.response.data;
      }
      throw error;
    }
  }

  async isUserExist(username: string) {
    let users = await this.doApiCall({
      url: "/admin/users",
      method: "GET"
    });
    users = users || [];
    const user = users.find(user => user.username === username);
    return !!user;
  }

  async createUser(data: CreateUser) {
    // validate data
    const validator = joi.object({
      email: joi
        .string()
        .email()
        .required(),
      first_name: joi.string().required(),
      last_name: joi.string().required(),
      username: joi.string().required()
    });
    await validator.validateAsync(data, { abortEarly: false });

    // create complex password
    const complexPassword = PasswordGenerator.generate({
      strict: true,
      excludeSimilarCharacters: true,
      length: 15,
      numbers: true,
      symbols: true,
      uppercase: true
    });

    const user = {
      email: data.email,
      full_name: `${data.first_name} ${data.last_name}`,
      login_name: data.username,
      must_change_password: true,
      password: complexPassword,
      send_notify: true,
      source_id: 0,
      username: data.username
    };

    // call gitea api to create user
    return this.doApiCall({
      url: "/admin/users",
      method: "POST",
      data: user
    });
  }

  async createOrganization(data: CreateOrganization) {
    // validate data
    const validator = joi.object({
      description: joi.string().required(),
      full_name: joi.string().required(),
      location: joi.string().required(),
      website: joi.string().required(),
      owner: joi.any().required()
    });
    await validator.validateAsync(data, { abortEarly: false });

    const orgId = `${data.full_name.replace(/ /g, "-")}-${RANDOM_NUMBER()}`;

    const org = {
      description: data.description,
      full_name: data.full_name,
      location: data.location,
      repo_admin_change_team_access: true,
      username: orgId,
      visibility: "public",
      website: data.website
    };
    // create organization api call
    return this.doApiCall({
      url: `/admin/users/${data.owner}/orgs`,
      method: "POST",
      data: org
    });
  }

  async createTeam(data: CreateTeam) {
    // validate data
    const validator = joi.object({
      description: joi.string().required(),
      name: joi
        .string()
        .pattern(/^[a-zA-Z0-9._-]+$/, { name: "alphanumeric" })
        .required(),
      orgId: joi.any().required()
    });
    await validator.validateAsync(data, { abortEarly: false });

    const team = {
      description: data.description,
      name: data.name,
      permission: "write",
      units: [
        "repo.code",
        "repo.issues",
        "repo.ext_issues",
        "repo.wiki",
        "repo.pulls",
        "repo.releases",
        "repo.ext_wiki"
      ]
    };
    // create organization api call
    return this.doApiCall({
      url: `/orgs/${data.orgId}/teams`,
      method: "POST",
      data: team
    });
  }

  async addTeamMemeber(data: AddTeamMemeber) {
    // validate data
    const validator = joi.object({
      teamId: joi.any().required(),
      userId: joi.string().required()
    });
    await validator.validateAsync(data, { abortEarly: false });

    // create organization api call
    return this.doApiCall({
      url: `/teams/${data.teamId}/members/${data.userId}`,
      method: "PUT"
    });
  }

  async forkRepo(data: ForkRepo) {
    // validate data
    const validator = joi.object({
      repoOwner: joi.string().required(),
      repoName: joi.string().required(),
      orgId: joi.string().required()
    });
    await validator.validateAsync(data, { abortEarly: false });

    // create organization api call
    return this.doApiCall({
      url: `/repos/${data.repoOwner}/${data.repoName}/forks`,
      method: "POST",
      data: {
        organization: data.orgId
      }
    });
  }
}

export default new Gitea();
