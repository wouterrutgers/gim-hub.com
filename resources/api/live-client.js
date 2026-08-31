import { fetchGameData } from "./game-data";
import { fetchChatMessages } from "./requests/chat";
import { fetchGroupCollectionLogs } from "./requests/collection-log";
import { fetchGroupData } from "./requests/group-data";
import { fetchMemberHiscores } from "./requests/hiscores";
import { addGroupMember, deleteGroupMember, renameGroupMember, updateMemberColor } from "./requests/group-members";
import { createMemberSnapshot, fetchMemberSnapshots } from "./requests/player-snapshot";
import { fetchSkillData } from "./requests/skill-data";

export default class LiveClient {
  baseURL = __API_URL__;

  constructor(credentials) {
    this.credentials = credentials;
  }

  fetchGameData() {
    return fetchGameData(this.baseURL);
  }

  fetchGroupData(fromTime) {
    return fetchGroupData({ baseURL: this.baseURL, credentials: this.credentials, fromTime });
  }

  fetchSkillData(period) {
    return fetchSkillData({ baseURL: this.baseURL, credentials: this.credentials, period });
  }

  addGroupMember(member) {
    return addGroupMember({ baseURL: this.baseURL, credentials: this.credentials, member });
  }

  renameGroupMember({ oldName, newName }) {
    return renameGroupMember({ baseURL: this.baseURL, credentials: this.credentials, oldName, newName });
  }

  deleteGroupMember(member) {
    return deleteGroupMember({ baseURL: this.baseURL, credentials: this.credentials, member });
  }

  fetchGroupCollectionLogs() {
    return fetchGroupCollectionLogs({ baseURL: this.baseURL, credentials: this.credentials });
  }

  fetchMemberSnapshots(markers) {
    return fetchMemberSnapshots({ baseURL: this.baseURL, credentials: this.credentials, markers });
  }

  createMemberSnapshot(member) {
    return createMemberSnapshot({ baseURL: this.baseURL, credentials: this.credentials, member });
  }

  fetchMemberHiscores(memberName) {
    return fetchMemberHiscores({ baseURL: this.baseURL, credentials: this.credentials, memberName });
  }

  updateMemberColor({ memberName, colorHueDegrees }) {
    return updateMemberColor({
      baseURL: this.baseURL,
      credentials: this.credentials,
      memberName,
      colorHueDegrees,
    });
  }

  fetchChatMessages(afterId) {
    return fetchChatMessages({ baseURL: this.baseURL, credentials: this.credentials, afterId });
  }
}

export async function authenticateGroup({ name, token }) {
  return fetch(`${__API_URL__}/group/${name}/am-i-logged-in`, {
    headers: { Authorization: token },
  });
}
