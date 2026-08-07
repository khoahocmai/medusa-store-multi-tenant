import { MedusaRequest, MedusaResponse, MedusaNextFunction } from "@medusajs/framework/http"

// Đệ quy dọn dẹp phần tử null trong mảng
function removeNullsFromArray(obj: any): any {
  if (Array.isArray(obj)) {
    return obj
      .filter(item => item !== null && item !== undefined)
      .map(removeNullsFromArray)
  } else if (obj !== null && typeof obj === 'object') {
    const newObj: any = {}
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        newObj[key] = removeNullsFromArray(obj[key])
      }
    }
    return newObj
  }
  return obj
}

export const cleanResponseDataMiddleware = (
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) => {
  const originalJson = res.json;
  
  // Override res.json để format data trước khi trả về client
  res.json = function(body: any) {
    if (body && typeof body === 'object') {
      body = removeNullsFromArray(body);
    }
    return originalJson.call(this, body);
  };

  next();
}
