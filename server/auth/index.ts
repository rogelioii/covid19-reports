import { Request, Response, NextFunction } from 'express';
import { ApiRequest, OrgParam } from '../api';
import { User } from '../api/user/user.model';
import { Role } from '../api/role/role.model';
import { ForbiddenError, UnauthorizedError } from '../util/error-types';

const sslHeader = 'ssl-client-subject-dn';

export async function requireUserAuth(req: AuthRequest, res: Response, next: NextFunction) {
  let id: string | undefined;

  if (req.header(sslHeader)) {
    const certificateContents = req.header(sslHeader);
    const commonName = certificateContents ? certificateContents.match(/CN=.+\.[0-9]{10}\b/ig) : null;
    if (commonName && commonName.length > 0) {
      id = commonName[0].substr(commonName[0].lastIndexOf('.') + 1, commonName[0].length);
    }
  } else if (process.env.NODE_ENV === 'development') {
    id = process.env.USER_EDIPI;
  }

  if (!id) {
    throw new UnauthorizedError('Client not authorized.', true);
  }

  const user = await User.findOne({
    relations: ['roles'],
    where: {
      edipi: id,
    },
    join: {
      alias: 'user',
      leftJoinAndSelect: {
        roles: 'user.roles',
        org: 'roles.org',
      },
    },
  });

  if (!user) {
    throw new ForbiddenError(`User '${id}' is not registered.`, true);
  }

  req.appUser = user;

  next();
}

export async function requireRootAdmin(req: ApiRequest, res: Response, next: NextFunction) {
  if (req.appUser.root_admin) {
    return next();
  }
  throw new ForbiddenError('User does not have sufficient privileges to perform this action.');
}

export function requireRolePermission(action: (role: Role) => boolean) {
  return async (req: ApiRequest<OrgParam>, res: Response, next: NextFunction) => {
    const org = parseInt(req.params.orgId);
    const user = req.appUser;
    if (org && user) {
      const orgRole = user.roles.find(role => role.org.id === org);
      if (user.root_admin || (orgRole && action(orgRole))) {
        return next();
      }
    }
    throw new ForbiddenError('User does not have sufficient privileges to perform this action.');
  };
}

type AuthRequest = {
  appUser?: User
} & Request;
