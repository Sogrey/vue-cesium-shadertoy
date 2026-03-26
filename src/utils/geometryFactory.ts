import type { GeometryType } from '@/types'

/**
 * 创建几何体
 */
export function createGeometry(
  cesium: typeof import('cesium'),
  type: GeometryType,
  scale: number = 200000,
  position?: { longitude: number; latitude: number; height: number },
) {
  const { Cartesian3, Matrix4, Transforms, GeometryInstance } = cesium

  let geometry: any

  switch (type) {
    case 'plane':
      geometry = createPlane(cesium, scale)
      break
    case 'sphere':
      geometry = createSphere(cesium, scale)
      break
    case 'cube':
      geometry = createCube(cesium, scale)
      break
    case 'cylinder':
      geometry = createCylinder(cesium, scale)
      break
    default:
      geometry = createPlane(cesium, scale)
  }

  // 计算模型矩阵，将几何体放置在指定位置
  let modelMatrix: any
  if (position) {
    const cartesianPosition = Cartesian3.fromDegrees(
      position.longitude,
      position.latitude,
      position.height,
    )
    // 创建以东-北-上为基准的局部坐标系
    modelMatrix = Transforms.eastNorthUpToFixedFrame(cartesianPosition)
    
    // 对于平面，需要旋转使其平行于地面
    if (type === 'plane') {
      // 平面需要绕 X 轴旋转 90 度，使其水平放置
      const pitchRotation = cesium.Matrix3.fromRotationX(-Math.PI / 2)
      const transform = new Matrix4()
      Matrix4.fromRotationTranslation(pitchRotation, Cartesian3.ZERO, transform)
      Matrix4.multiply(modelMatrix, transform, modelMatrix)
    }
  } else {
    modelMatrix = Matrix4.IDENTITY.clone()
  }

  const geometryInstance = new GeometryInstance({
    geometry,
    modelMatrix,
  })

  return geometryInstance
}

/**
 * 创建平面
 */
function createPlane(cesium: typeof import('cesium'), scale: number) {
  const { Geometry, GeometryAttribute, ComponentDatatype, PrimitiveType, BoundingSphere } = cesium

  const halfSize = scale
  const positions = new Float64Array([
    -halfSize,
    0,
    -halfSize,
    halfSize,
    0,
    -halfSize,
    halfSize,
    0,
    halfSize,
    -halfSize,
    0,
    halfSize,
  ])

  const textureCoordinates = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])

  const indices = new Uint16Array([0, 1, 2, 0, 2, 3])

  // 计算 boundingSphere
  const boundingSphere = BoundingSphere.fromVertices(positions as unknown as number[])

  const geometry = new Geometry({
    attributes: {
      position: new GeometryAttribute({
        componentDatatype: ComponentDatatype.DOUBLE,
        componentsPerAttribute: 3,
        values: positions,
      }),
      st: new GeometryAttribute({
        componentDatatype: ComponentDatatype.FLOAT,
        componentsPerAttribute: 2,
        values: textureCoordinates,
      }),
    } as any,
    indices,
    primitiveType: PrimitiveType.TRIANGLES,
    boundingSphere,
  })

  return geometry
}

/**
 * 创建球体
 */
function createSphere(cesium: typeof import('cesium'), scale: number) {
  const { SphereGeometry } = cesium
  return SphereGeometry.createGeometry(new SphereGeometry({ radius: scale }))
}

/**
 * 创建立方体
 */
function createCube(cesium: typeof import('cesium'), scale: number) {
  const { BoxGeometry } = cesium
  return BoxGeometry.createGeometry(
    new BoxGeometry({
      minimum: new cesium.Cartesian3(-scale, -scale, -scale),
      maximum: new cesium.Cartesian3(scale, scale, scale),
    }),
  )
}

/**
 * 创建圆柱体
 */
function createCylinder(cesium: typeof import('cesium'), scale: number) {
  const { CylinderGeometry } = cesium
  return CylinderGeometry.createGeometry(
    new CylinderGeometry({
      length: scale * 2,
      topRadius: scale,
      bottomRadius: scale,
    }),
  )
}

/**
 * 创建 Primitive
 */
export function createPrimitive(
  cesium: typeof import('cesium'),
  geometryInstance: any,
  material: any,
) {
  const { Primitive, MaterialAppearance } = cesium

  return new Primitive({
    geometryInstances: geometryInstance,
    appearance: new MaterialAppearance({
      material,
      faceForward: true,
      closed: true,
    }),
    asynchronous: false,
  })
}
