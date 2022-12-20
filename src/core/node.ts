import type { Buffer } from "./buffer";

export class ModuleNode {
  magic: Uint8Array;
  version: Uint8Array;
  sections: SectionNode[] = [];

  constructor(buffer: Buffer) {
    this.magic = buffer.readBytes(4);
    this.version = buffer.readBytes(4);

    while (true) {
      if (buffer.eof) break;

      this.sections.push(loadSection(buffer));
    }
  }
}

const loadSection = (buffer: Buffer) => {
  const sectionId = buffer.readByte();
  const sectionSize = buffer.readU32();
  const sectionsBuffer = buffer.readBuffer(sectionSize);

  return createSectionNode(sectionId, sectionsBuffer);
};

type SectionNode = TypeSectionNode | FunctionSectionNode | CodeSectionNode;

const createSectionNode = (sectionId: number, buffer: Buffer): SectionNode => {
  switch (sectionId) {
    case 1:
      return new TypeSectionNode(buffer);
    case 3:
      return new FunctionSectionNode(buffer);
    case 10:
      return new CodeSectionNode(buffer);
    default:
      throw new Error(`invaild section id: ${sectionId}`);
  }
};

export class TypeSectionNode {
  funcTypes: FuncTypeNode[] = [];

  constructor(buffer: Buffer) {
    this.funcTypes = buffer.readVec(() => new FuncTypeNode(buffer));
  }
}

const FUNC_TYPE_TAG = 0x60;

const I32 = 0x7f;
const I64 = 0x7e;
const F32 = 0x7d;
const F64 = 0x7c;
type NumType = typeof I32 | typeof I64 | typeof F32 | typeof F64;
const FUNC_REF = 0x70;
const EXTERN_REF = 0x6f;
type RefType = typeof FUNC_REF | typeof EXTERN_REF;
type ValType = NumType | RefType;

export class FuncTypeNode {
  paramType: ResultTypeNode;
  resultType: ResultTypeNode;

  constructor(buffer: Buffer) {
    if (buffer.readByte() !== FUNC_TYPE_TAG) {
      throw new Error("invalid functype");
    }
    this.paramType = new ResultTypeNode(buffer);
    this.resultType = new ResultTypeNode(buffer);
  }
}

export class ResultTypeNode {
  valTypes: ValType[] = [];

  constructor(buffer: Buffer) {
    this.valTypes = buffer.readVec(() => buffer.readByte() as ValType);
  }
}

type TypeIdx = number;

export class FunctionSectionNode {
  typeIdxs: TypeIdx[];

  constructor(buffer: Buffer) {
    this.typeIdxs = buffer.readVec(() => buffer.readU32() as TypeIdx);
  }
}

export class CodeSectionNode {
  codes: CodeNode[];

  constructor(buffer: Buffer) {
    this.codes = buffer.readVec(() => new CodeNode(buffer));
  }
}

export class CodeNode {
  size: number;
  func: FuncNode;

  constructor(buffer: Buffer) {
    this.size = buffer.readU32();
    this.func = new FuncNode(buffer.readBuffer(this.size));
  }
}

export class FuncNode {
  localses: LocalsNode[] = [];
  expr: ExprNode;

  constructor(buffer: Buffer) {
    this.localses = buffer.readVec(() => new LocalsNode(buffer));
    this.expr = new ExprNode(buffer);
  }
}

export class LocalsNode {
  num: number;
  valType: ValType;

  constructor(buffer: Buffer) {
    this.num = buffer.readU32();
    this.valType = buffer.readByte() as ValType;
  }
}

export class ExprNode {
  instrs: InstrNode[] = [];
  endOp!: Op;

  constructor(buffer: Buffer) {
    while (true) {
      const opcode = buffer.readByte() as Op;
      if (opcode === Op.End) {
        this.endOp = opcode;
        break;
      }
      this.instrs.push(createInstrNode(opcode, buffer));
      if (buffer.eof) break;
    }
  }
}
const Op = {
  I32Const: 0x41,
  End: 0x0b,
} as const;
type Op = typeof Op[keyof typeof Op];

export class InstrNode {
  opcode: Op;
  constructor(opcode: Op) {
    this.opcode = opcode;
  }
}

const createInstrNode = (opcode: Op, buffer: Buffer) => {
  switch (opcode) {
    case Op.I32Const:
      return new I32ConstInstrNode(opcode, buffer);
    default:
      throw new Error(`invalid opcode: 0x${opcode.toString(16)}`);
  }
};

export class I32ConstInstrNode extends InstrNode {
  num: number;

  constructor(op: Op, buffer: Buffer) {
    super(op);
    this.num = buffer.readI32();
  }
}
