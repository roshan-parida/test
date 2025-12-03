import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { StoresService } from '../../stores/stores.service';

@Injectable()
export class StoreAccessGuard implements CanActivate {
	constructor(private readonly storesService: StoresService) {}

	canActivate(context: ExecutionContext): boolean | Promise<boolean> {
		const request = context.switchToHttp().getRequest();
		const user = request.user;

		const storeId =
			(request.params && request.params.storeId) ||
			(request.body && (request.body.storeId || request.body._id)) ||
			(request.query && request.query.storeId);

		if (!storeId) return true;

		if (user && user.role === 'ADMIN') return true;

		return this.storesService.canAccessStore(user, storeId);
	}
}
